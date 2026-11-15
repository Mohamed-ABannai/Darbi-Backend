const router = require("express").Router();
const Payment = require("../models/Payment");
const Lesson = require("../models/lesson");
const Invoice = require("../models/invoice");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");

router.get("/", verifyToken, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate({
        path: "lesson",
        populate: {
          path: "TrainingPlan",
          populate: [
            { path: "learner", select: "username" },
            { path: "instructor", select: "username hourlyRate" }
          ]
        }
      })
      .sort({ createdAt: -1 });

    if (req.user.role === "admin" || req.user.role === "superAdmin") {
      return res.json(payments);
    }

    if (req.user.role === "learner") {
      const learnerPayments = payments.filter(
        (payment) =>
          payment.lesson?.TrainingPlan?.learner?._id?.toString() ===
          req.user._id.toString()
      );
      return res.json(learnerPayments);
    }

    if (req.user.role === "instructor") {
      const instructorPayments = payments.filter(
        (payment) =>
          payment.lesson?.TrainingPlan?.instructor?._id?.toString() ===
          req.user._id.toString()
      );
      return res.json(instructorPayments);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate({
      path: "lesson",
      populate: {
        path: "TrainingPlan",
        populate: [
          { path: "learner", select: "username" },
          { path: "instructor", select: "username hourlyRate" }
        ]
      }
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const plan = payment.lesson?.TrainingPlan;

    if (
      plan?.learner?._id?.toString() === req.user._id.toString() ||
      plan?.instructor?._id?.toString() === req.user._id.toString() ||
      req.user.role === "admin" ||
      req.user.role === "superAdmin"
    ) {
      return res.json(payment);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "learner" && req.user.role !== "instructor") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { lesson: lessonId, amount, method } = req.body;

    if (!lessonId || amount === undefined || Number(amount) <= 0) {
      return res.status(400).json({ message: "Invalid payment details" });
    }

    const lesson = await Lesson.findById(lessonId).populate("TrainingPlan");

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const plan = lesson.TrainingPlan;

    if (
      req.user.role === "learner" &&
      plan.learner.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (
      req.user.role === "instructor" &&
      plan.instructor.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const existingPayment = await Payment.findOne({ lesson: lessonId });
    if (existingPayment) {
      return res
        .status(400)
        .json({ message: "Payment already exists for this lesson" });
    }

    const newPayment = await Payment.create({
      lesson: lessonId,
      amount: Number(amount),
      method: method || "Cash",
      status: "pending"
    });

    return res.status(201).json(newPayment);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: err.message });
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

    const plan = payment.lesson?.TrainingPlan;

    if (!plan) {
      return res.status(404).json({ message: "Training plan not found" });
    }

    const { status, method, cancellationReason } = req.body;
    const updateData = {};

    if (req.user.role === "learner") {
      if (plan.learner.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (payment.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Cannot modify a completed payment" });
      }
      if (method) updateData.method = method;
      if (status === "completed" || status === "paid") {
        updateData.status = "completed";
      }
    } else if (req.user.role === "instructor") {
      if (plan.instructor.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (status) {
        updateData.status = status === "paid" ? "completed" : status;
      }
      if (cancellationReason) {
        updateData.cancellationReason = cancellationReason;
      }
    } else if (req.user.role === "admin" || req.user.role === "superAdmin") {
      if (status) {
        updateData.status = status === "paid" ? "completed" : status;
      }
      if (method) updateData.method = method;
      if (cancellationReason) {
        updateData.cancellationReason = cancellationReason;
      }
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    const updatedPayment = await Payment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (updatedPayment.status === "completed") {
      const existingInvoice = await Invoice.findOne({
        payment: updatedPayment._id
      });
      if (!existingInvoice) {
        await Invoice.create({
          payment: updatedPayment._id,
          date: new Date(),
          amount: updatedPayment.amount,
          status: "paid"
        });
      }
    }

    return res.json(updatedPayment);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: err.message });
  }
});

module.exports = router;