const express = require("express");
const router = express.Router();
const Lesson = require("../models/lesson");
const TrainingPlan = require("../models/TrainingPlan");
const Payment = require("../models/Payment");
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");

router.use(verifyToken);

// Get all lessons (with populated TrainingPlan, learner, and instructor)
router.get("/", async (req, res) => {
  try {
    const populateOptions = {
      path: "TrainingPlan",
      populate: [
        { path: "learner", select: "username" },
        { path: "instructor", select: "username hourlyRate" }
      ]
    };

    if (req.user.role === "admin" || req.user.role === "superAdmin") {
      const lessons = await Lesson.find()
        .populate(populateOptions)
        .sort({ date: 1 });
      return res.json(lessons);
    }

    let plans;

    if (req.user.role === "learner") {
      plans = await TrainingPlan.find({ learner: req.user._id });
    } else if (req.user.role === "instructor") {
      plans = await TrainingPlan.find({ instructor: req.user._id });
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    const planIds = plans.map((plan) => plan._id);

    const lessons = await Lesson.find({
      TrainingPlan: { $in: planIds }
    })
      .populate(populateOptions)
      .sort({ date: 1 });

    return res.json(lessons);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Get single lesson by ID
router.get("/:id", validateObjectId, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id).populate({
      path: "TrainingPlan",
      populate: [
        { path: "learner", select: "username" },
        { path: "instructor", select: "username hourlyRate" }
      ]
    });

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const plan = lesson.TrainingPlan;

    if (!plan) {
      return res.status(404).json({ message: "Training plan not found" });
    }

    if (
      plan.learner._id.toString() === req.user._id.toString() ||
      plan.instructor._id.toString() === req.user._id.toString() ||
      req.user.role === "admin" ||
      req.user.role === "superAdmin"
    ) {
      return res.json(lesson);
    } else {
      return res.status(403).json({ message: "Access denied" });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Create a new lesson (Instructors only)
router.post("/", async (req, res) => {
  try {
    if (req.user.role !== "instructor") {
      return res.status(403).json({ message: "Instructors only" });
    }

    const { TrainingPlan: planId, date, hours } = req.body;

    if (!planId || !date || hours === undefined || Number(hours) <= 0) {
      return res.status(400).json({ message: "Invalid lesson details" });
    }

    const plan = await TrainingPlan.findById(planId);

    if (
      !plan ||
      plan.instructor.toString() !== req.user._id.toString() ||
      plan.status !== "active"
    ) {
      return res.status(403).json({ message: "Invalid or inactive training plan" });
    }

    const newLesson = await Lesson.create({
      TrainingPlan: planId,
      date,
      hours: Number(hours),
      status: "scheduled"
    });

    return res.status(201).json(newLesson);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: err.message });
  }
});

// Update, Complete (auto-generates payment), or Cancel a single lesson
router.put("/:id", validateObjectId, async (req, res) => {
  try {
    if (req.user.role !== "instructor" && req.user.role !== "learner") {
      return res.status(403).json({ message: "Access denied" });
    }

    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const plan = await TrainingPlan.findById(lesson.TrainingPlan);
    if (!plan) {
      return res.status(404).json({ message: "Training plan not found" });
    }

    if (
      req.user.role === "instructor" &&
      plan.instructor.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (
      req.user.role === "learner" &&
      plan.learner.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (plan.status !== "active" || lesson.status !== "scheduled") {
      return res.status(400).json({ message: "Cannot update this lesson" });
    }

    const { date, hours, status, cancellationReason } = req.body;

    // Learners can only cancel their individual lesson
    if (req.user.role === "learner") {
      if (status !== "cancelled" || date !== undefined || hours !== undefined) {
        return res.status(403).json({ message: "Learners can only cancel lessons" });
      }
    }

    if (status && status !== "completed" && status !== "cancelled") {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updateData = {};

    if (req.user.role === "instructor") {
      if (date !== undefined) updateData.date = date;
      if (hours !== undefined) updateData.hours = Number(hours);
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    const finalHours = hours !== undefined ? Number(hours) : lesson.hours;

    if (status === "completed" && finalHours <= 0) {
      return res
        .status(400)
        .json({ message: "Completed lessons must have hours greater than zero" });
    }

    if (status === "cancelled") {
      if (!cancellationReason || !cancellationReason.trim()) {
        return res.status(400).json({ message: "Cancellation reason is required" });
      }
      updateData.cancellationReason = cancellationReason.trim();
    }

    const updatedLesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    // Auto-generate payment when instructor marks lesson as completed
    if (status === "completed") {
      const existingPayment = await Payment.findOne({ lesson: updatedLesson._id });

      if (!existingPayment) {
        const instructor = await User.findById(plan.instructor);
        const hourlyRate = instructor?.hourlyRate || 22;
        const calculatedAmount = updatedLesson.hours * hourlyRate;

        await Payment.create({
          lesson: updatedLesson._id,
          amount: calculatedAmount,
          method: "Cash",
          status: "pending"
        });
      }
    }

    return res.json(updatedLesson);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: err.message });
  }
});

// Delete a scheduled lesson (Instructors & Admins)
router.delete("/:id", validateObjectId, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const plan = await TrainingPlan.findById(lesson.TrainingPlan);

    if (!plan) {
      return res.status(404).json({ message: "Training plan not found" });
    }

    if (
      plan.instructor.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "superAdmin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (lesson.status !== "scheduled") {
      return res.status(400).json({ message: "Only scheduled lessons can be deleted" });
    }

    await Lesson.findByIdAndDelete(req.params.id);

    return res.json({ message: "Lesson deleted successfully" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;