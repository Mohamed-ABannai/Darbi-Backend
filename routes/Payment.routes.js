const router = require("express").Router();
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");
const Payment = require("../models/Payment");
const Lesson = require("../models/lesson");
const Invoice = require("../models/invoice");

router.get("/", verifyToken, async (req, res) => {
  try {
    const allPayments = await Payment.find().populate({
      path: "lesson",
      populate: { path: "TrainingPlan" }
    });

    if (req.user.role == "admin" || req.user.role == "superAdmin") {
      return res.json(allPayments);
    }
    else if (req.user.role == "learner") {
      const myPayments = allPayments.filter(
        (payment) =>
          payment.lesson &&
          payment.lesson.TrainingPlan &&
          payment.lesson.TrainingPlan.learner == req.user._id
      );

      return res.json(myPayments);
    }
    else if (req.user.role == "instructor") {
      const instructorPayments = allPayments.filter(
        (payment) =>
          payment.lesson &&
          payment.lesson.TrainingPlan &&
          payment.lesson.TrainingPlan.instructor == req.user._id
      );

      return res.json(instructorPayments);
    }
    else {
      return res.status(403).json({ message: "Access denied" });
    }

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role != "learner") {
      return res.status(403).json({ message: "Learners only" });
    }

    const { lesson, amount, method } = req.body;

    if (!lesson || !amount || !method || amount <= 0) {
      return res.status(400).json({ message: "Invalid payment details" });
    }

    const foundLesson = await Lesson.findById(lesson)
      .populate("TrainingPlan");

    if (!foundLesson || !foundLesson.TrainingPlan) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    if (foundLesson.TrainingPlan.learner != req.user._id) {
      return res.status(403).json({
        message: "You can only pay for your own lessons"
      });
    }

    const existingPayment = await Payment.findOne({
      lesson: lesson,
      status: { $in: ["pending", "completed"] }
    });

    if (existingPayment) {
      return res.status(400).json({
        message: "Payment already exists for this lesson"
      });
    }

    const newPayment = await Payment.create({
      lesson,
      amount,
      method,
      status: "pending"
    });

    return res.status(201).json(newPayment);

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate({
      path: "lesson",
      populate: { path: "TrainingPlan" }
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (!payment.lesson || !payment.lesson.TrainingPlan) {
      return res.status(404).json({ message: "Training plan not found" });
    }

    const plan = payment.lesson.TrainingPlan;

    if (payment.status != "pending") {
      return res.status(400).json({
        message: "Only pending payments can be updated"
      });
    }

    if (req.user.role == "learner") {
      if (plan.learner != req.user._id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { amount, method } = req.body;
      const updateData = {};

      if (amount !== undefined) {
        if (amount <= 0) {
          return res.status(400).json({ message: "Invalid amount" });
        }
        updateData.amount = amount;
      }

      if (method !== undefined) {
        updateData.method = method;
      }

      const updatedPayment = await Payment.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      return res.json(updatedPayment);
    }

    else if (
      req.user.role == "instructor" ||
      req.user.role == "admin" ||
      req.user.role == "superAdmin"
    ) {
      if (
        req.user.role == "instructor" &&
        plan.instructor != req.user._id
      ) {
        return res.status(403).json({
          message: "You can only manage your learners' payments"
        });
      }

      const { status, cancellationReason } = req.body;

      if (status != "completed" && status != "rejected") {
        return res.status(400).json({
          message: "Invalid payment status"
        });
      }

      const updatedPayment = await Payment.findByIdAndUpdate(
        req.params.id,
        {
          status: status,
          cancellationReason: cancellationReason
        },
        { new: true, runValidators: true }
      );

      if (status == "completed") {
        const existingInvoice = await Invoice.findOne({
          payment: payment._id
        });

        if (!existingInvoice) {
          const newInvoice = await Invoice.create({
            payment: payment._id,
            date: new Date(),
            amount: payment.amount,
            status: "paid"
          });
        }
      }

      return res.json(updatedPayment);
    }

    else {
      return res.status(403).json({ message: "Access denied" });
    }

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;