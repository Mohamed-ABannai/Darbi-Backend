const router = require("express").Router();
const verifyToken = require("../middleware/verifyToken");
const Payment = require("../models/Payment");
const Lesson = require("../models/lesson");
const TrainingPlan = require("../models/TrainingPlan");

router.get("/", verifyToken, async (req, res) => {
  try {
    const allPayments = await Payment.find().populate({
      path: "lesson",
      populate: { path: "TrainingPlan" },
    });

    if (req.user.role === "admin") {
      return res.status(200).json(allPayments);
    }

    if (req.user.role === "learner") {
      const myPayments = allPayments.filter(
        (payment) =>
          payment.lesson &&
          payment.lesson.TrainingPlan &&
          payment.lesson.TrainingPlan.learner == req.user._id
      );
      return res.status(200).json(myPayments);
    }

    if (req.user.role === "instructor") {
      const instructorPayments = allPayments.filter(
        (payment) =>
          payment.lesson &&
          payment.lesson.TrainingPlan &&
          payment.lesson.TrainingPlan.instructor == req.user._id
      );
      return res.status(200).json(instructorPayments);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "learner") {
      return res
        .status(403)
        .json({ message: "Only learners can create payments." });
    }

    const { lesson, amount, method } = req.body;

    if (!lesson || !amount || !method) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const checkLesson = await Lesson.findById(lesson).populate("TrainingPlan");
    if (!checkLesson) {
      return res.status(404).json({ message: "Lesson not found." });
    }

    if (checkLesson.TrainingPlan.learner.toString() !== req.user._id) {
      return res
        .status(403)
        .json({ message: "You can only pay for your own lessons" });
    }

    const existingPayment = await Payment.findOne({
      lesson: lesson,
      status: "completed",
    });
    if (existingPayment) {
      return res
        .status(400)
        .json({ message: "This lesson is already paid for" });
    }

    const newPayment = await Payment.create({
      lesson,
      amount,
      method,
      status: "pending",
    });

    return res.status(201).json(newPayment);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate({
      path: "lesson",
      populate: { path: "TrainingPlan" },
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const plan = payment.lesson.TrainingPlan;

    if (req.user.role === "learner") {
      if (plan.learner.toString() !== req.user._id) {
        return res
          .status(403)
          .json({ message: "You can only update your own payments" });
      }

      if (payment.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Only pending payments can be updated" });
      }

      const { amount, method } = req.body;
      let updateFields = {};
      if (amount) updateFields.amount = amount;
      if (method) updateFields.method = method;

      const updatedPayment = await Payment.findByIdAndUpdate(
        req.params.id,
        updateFields,
        { new: true }
      );

      return res.status(200).json(updatedPayment);
    }

    if (req.user.role === "instructor" || req.user.role === "admin") {
      if (
        req.user.role === "instructor" &&
        plan.instructor.toString() !== req.user._id
      ) {
        return res.status(403).json({
          message: "You can only manage payments for your own students",
        });
      }

      const { status, cancellationReason, cancellationRReason } = req.body;
      let reviewFields = {};

      if (status) {
        if (!["completed", "rejected"].includes(status)) {
          return res
            .status(400)
            .json({ message: "Status must be either completed or rejected" });
        }
        reviewFields.status = status;
      }

      const reason = cancellationRReason || cancellationReason;
      if (reason) {
        reviewFields.cancellationRReason = reason;
      }

      const updatedPayment = await Payment.findByIdAndUpdate(
        req.params.id,
        reviewFields,
        { new: true }
      );

      return res.status(200).json(updatedPayment);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;