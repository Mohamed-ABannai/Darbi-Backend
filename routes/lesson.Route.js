const express = require("express");
const router = express.Router();
const Lesson = require("../models/lesson");
const TrainingPlan = require("../models/TrainingPlan");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");

router.use(verifyToken);

router.get("/", async (req, res) => {
  try {
    if (req.user.role == "admin" || req.user.role == "superAdmin") {
      const lessons = await Lesson.find();
      return res.json(lessons);
    }

    let plans;

    if (req.user.role == "learner") {
      plans = await TrainingPlan.find({ learner: req.user._id });
    }
    else if (req.user.role == "instructor") {
      plans = await TrainingPlan.find({ instructor: req.user._id });
    }
    else {
      return res.status(403).json({ message: "Access denied" });
    }

    const planIds = plans.map((plan) => plan._id);

    const lessons = await Lesson.find({
      TrainingPlan: { $in: planIds }
    });

    return res.json(lessons);

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", validateObjectId, async (req, res) => {
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
      plan.learner == req.user._id ||
      plan.instructor == req.user._id ||
      req.user.role == "admin" ||
      req.user.role == "superAdmin"
    ) {
      return res.json(lesson);
    }
    else {
      return res.status(403).json({ message: "Access denied" });
    }

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    if (req.user.role != "instructor") {
      return res.status(403).json({ message: "Instructors only" });
    }

    const { TrainingPlan: planId, date, hours } = req.body;

    if (!planId || !date || hours === undefined || hours < 0) {
      return res.status(400).json({ message: "Invalid lesson details" });
    }

    const plan = await TrainingPlan.findById(planId);

    if (!plan || plan.instructor != req.user._id || plan.status != "active") {
      return res.status(403).json({ message: "Invalid training plan" });
    }

    const newLesson = await Lesson.create({
      TrainingPlan: planId,
      date,
      hours,
      status: "scheduled"
    });

    return res.status(201).json(newLesson);

  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: err.message });
  }
});

router.put("/:id", validateObjectId, async (req, res) => {
  try {
    if (req.user.role != "instructor") {
      return res.status(403).json({ message: "Instructors only" });
    }

    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const plan = await TrainingPlan.findById(lesson.TrainingPlan);

    if (!plan || plan.instructor != req.user._id) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (plan.status != "active" || lesson.status != "scheduled") {
      return res.status(400).json({ message: "Cannot update this lesson" });
    }

    const { date, hours, status, cancellationReason } = req.body;

    if (status && status != "completed" && status != "cancelled") {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updateData = {};

    if (date !== undefined) updateData.date = date;
    if (hours !== undefined) updateData.hours = hours;
    if (status !== undefined) updateData.status = status;

    if (status == "completed" && Number(hours === undefined ? lesson.hours : hours) <= 0) {
      return res.status(400).json({ message: "Completed lessons must have hours greater than zero" });
    }

    if (status == "cancelled") {
      if (!cancellationReason) {
        return res.status(400).json({ message: "Cancellation reason is required" });
      }

      updateData.cancellationReason = cancellationReason;
    }

    const updatedLesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    return res.json(updatedLesson);

  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: err.message });
  }
});

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
      plan.instructor != req.user._id &&
      req.user.role != "admin" &&
      req.user.role != "superAdmin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (lesson.status != "scheduled") {
      return res.status(400).json({ message: "Only scheduled lessons can be deleted" });
    }

    const deletedLesson = await Lesson.findByIdAndDelete(req.params.id);

    return res.json({ message: "Lesson deleted successfully" });

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;