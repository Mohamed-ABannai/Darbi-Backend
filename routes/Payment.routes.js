const router = require("express").Router();
const mongoose = require("mongoose");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");
const Payment = require("../models/Payment");
const Lesson = require("../models/lesson");
const Invoice = require("../models/invoice");

router.get("/", verifyToken, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "learner") filter.learner = req.user._id;
    else if (req.user.role === "instructor") filter.instructor = req.user._id;
    else if (req.user.role !== "admin" && req.user.role !== "superAdmin") return res.status(403).json({ message: "Access denied" });
    const allPayments = await Payment.find(filter).populate("learner", "username").populate("instructor", "username").populate({ path: "lesson", populate: { path: "TrainingPlan", populate: [{ path: "learner", select: "username" }, { path: "instructor", select: "username" }] } });
    return res.json(allPayments);

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

    const { lesson: lessonId, method } = req.body;
    if (!lessonId || !["Cash", "benefitPay", "bank transfer"].includes(method)) return res.status(400).json({ message: "Choose a completed lesson and supported payment method" });
    if (!mongoose.Types.ObjectId.isValid(lessonId)) return res.status(400).json({ message: "Invalid lesson ID" });
    const payment = await Payment.findOne({ lesson: lessonId, learner: req.user._id });
    if (!payment) return res.status(404).json({ message: "Payment not found for this learner" });
    if (payment.status !== "unsubmitted") return res.status(400).json({ message: "This payment has already been submitted" });
    const lesson = await Lesson.findById(lessonId);
    if (!lesson || lesson.status !== "completed") return res.status(400).json({ message: "Only completed lessons can be paid" });
    payment.method = method;
    payment.status = "pending";
    await payment.save();
    return res.json(payment);

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

      const { method } = req.body;
      if (!payment.lesson || payment.lesson.status !== "completed") return res.status(400).json({ message: "Only completed lessons can be paid" });
      if (!["Cash", "benefitPay", "bank transfer"].includes(method)) return res.status(400).json({ message: "Choose a supported payment method" });

      const updatedPayment = await Payment.findByIdAndUpdate(
        req.params.id,
        { method },
        { new: true, runValidators: true }
      );

      return res.json(updatedPayment);
    }

    else if (
      req.user.role == "instructor" ||
      req.user.role == "admin" ||
      req.user.role == "superAdmin"
    ) {
      if (payment.lesson.status !== "completed") return res.status(400).json({ message: "Only completed lessons can have payment confirmed" });
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
          await Invoice.create({
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
