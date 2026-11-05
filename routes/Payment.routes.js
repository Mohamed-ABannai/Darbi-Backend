const router = require("express").Router();
const verifyToken = require("../middleware/verifyToken");
const Payment = require("../models/Payment");
const TrainingPlan = require("../models/TrainingPlan");
const Lesson = require("../models/lesson");

router.get("/", verifyToken, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "learner") {
      filter = { Learner: req.user._id };
    } else if (req.user.role === "instructor") {
      filter = { instructor: req.user._id };
    } else if (req.user.role === "admin") {
      filter = {}; // Admin can see all payments
    }

    const allPayments = await Payment.find(filter)
      .populate("Learner")
      .populate("instructor");
    return res.status(200).json(allPayments);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
      Learner: req.user._id,
    });
    res.status(201).json(newPayment);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
        { new: true },
      );

      res.status(200).json(updatedPayment);
    }

    if (req.user.role === "instructor" || req.user.role === "admin") {
      if (
        req.user.role === "instructor" &&
        plan.instructor.toString() !== req.user._id
      ) {
        return res
          .status(403)
          .json({
            message: "You can only manage payments for your own students",
          });
      }

      const { status, cancellationReason } = req.body;
      let reviewFields = {};

      if (status) {
        if (!["completed", "rejected"].includes(status)) {
          return res
            .status(400)
            .json({ message: "Status must be either completed or rejected" });
        }
        reviewFields.status = status;
      }

      if (cancellationReason) {
        reviewFields.cancellationReason = cancellationReason;
      }

      const updatedPayment = await Payment.findByIdAndUpdate(
        req.params.id,
        reviewFields,
        { new: true },
      );

      return res.status(200).json(updatedPayment);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
