const router = require("express").Router();
const Lesson = require("../models/lesson");
const TrainingPlan = require("../models/TrainingPlan");
const Payment = require("../models/Payment");
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");

router.use(verifyToken);

router.get("/", async (req, res) => {
  try {
    let plans = [];
    if (req.user.role === "learner") plans = await TrainingPlan.find({ learner: req.user._id });
    else if (req.user.role === "instructor") plans = await TrainingPlan.find({ instructor: req.user._id });
    else if (req.user.role !== "admin" && req.user.role !== "superAdmin") return res.status(403).json({ message: "Access denied" });

    const planIds = plans.map((plan) => plan._id);
    const filter = req.user.role === "admin" || req.user.role === "superAdmin" ? {} : { TrainingPlan: { $in: planIds } };
    const lessons = await Lesson.find(filter).populate({ path: "TrainingPlan", populate: [{ path: "learner", select: "username" }, { path: "instructor", select: "username hourlyRate" }] });
    return res.json(lessons);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load lessons" });
  }
});

router.post("/", async (req, res) => {
  try {
    if (req.user.role !== "learner") return res.status(403).json({ message: "Learners only" });
    const { TrainingPlan: planId, date, hours } = req.body;
    const lessonDate = new Date(date);
    const duration = Number(hours);
    if (!planId || !date || Number.isNaN(lessonDate.getTime()) || !Number.isFinite(duration) || duration <= 0 || duration > 8) {
      return res.status(400).json({ message: "Choose a valid date and duration from 0 to 8 hours" });
    }
    const plan = await TrainingPlan.findById(planId).populate("instructor", "hourlyRate");
    if (!plan || String(plan.learner) !== String(req.user._id) || plan.status !== "active") return res.status(403).json({ message: "An active training plan is required" });
    if (lessonDate <= new Date()) return res.status(400).json({ message: "Choose a future lesson date and time" });
    if (!Number.isFinite(Number(plan.instructor.hourlyRate)) || Number(plan.instructor.hourlyRate) <= 0) return res.status(400).json({ message: "The instructor does not have a valid hourly rate" });
    const lessonEnd = new Date(lessonDate.getTime() + duration * 60 * 60 * 1000);
    const instructorPlanIds = await TrainingPlan.find({ instructor: plan.instructor._id }).distinct("_id");
    const existingLessons = await Lesson.find({
      TrainingPlan: { $in: instructorPlanIds },
      status: { $in: ["pending", "scheduled"] }
    });
    const conflict = existingLessons.some((lesson) => {
      const existingEnd = new Date(new Date(lesson.date).getTime() + Number(lesson.hours) * 60 * 60 * 1000);
      return lessonDate < existingEnd && lessonEnd > new Date(lesson.date);
    });
    if (conflict) return res.status(409).json({ message: "The instructor already has a lesson at that time" });

    const hourlyRate = Number(plan.instructor.hourlyRate || 0);
    const lesson = await Lesson.create({ TrainingPlan: plan._id, date: lessonDate, hours: duration, hourlyRate, hourlyRateSnapshot: hourlyRate, amountSnapshot: Number((duration * hourlyRate).toFixed(3)), status: "pending" });
    return res.status(201).json(lesson);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to request lesson" });
  }
});

router.put("/:id", validateObjectId, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    const plan = await TrainingPlan.findById(lesson.TrainingPlan);
    if (!plan) return res.status(404).json({ message: "Training plan not found" });
    const isLearner = req.user.role === "learner" && String(plan.learner) === String(req.user._id);
    const isInstructor = req.user.role === "instructor" && String(plan.instructor) === String(req.user._id);
    if (!isLearner && !isInstructor) return res.status(403).json({ message: "Access denied" });
    if (plan.status !== "active") return res.status(400).json({ message: "The training plan is not active" });

    if (req.body.status === "cancelled" && (isLearner || isInstructor)) {
      if (!["pending", "scheduled"].includes(lesson.status)) return res.status(400).json({ message: "This lesson cannot be cancelled" });
      if (!req.body.cancellationReason?.trim()) return res.status(400).json({ message: "Cancellation reason is required" });
      lesson.status = "cancelled";
      lesson.cancellationReason = req.body.cancellationReason.trim();
      await lesson.save();
      return res.json(lesson);
    }
    if (isInstructor && req.body.status === "scheduled") {
      if (lesson.status !== "pending") return res.status(400).json({ message: "Only pending bookings can be accepted" });
      lesson.status = "scheduled";
      await lesson.save();
      return res.json(lesson);
    }
    if (isInstructor && req.body.status === "rejected") {
      if (lesson.status !== "pending") return res.status(400).json({ message: "Only pending bookings can be rejected" });
      lesson.status = "rejected";
      await lesson.save();
      return res.json(lesson);
    }
    if (isInstructor && req.body.status === "completed") {
      if (lesson.status !== "scheduled") return res.status(400).json({ message: "Only accepted lessons can be completed" });
      if (lesson.hours <= 0) return res.status(400).json({ message: "Lesson hours must be greater than zero" });
      const instructor = await User.findById(plan.instructor);
      const hourlyRate = Number(lesson.hourlyRateSnapshot || lesson.hourlyRate || instructor?.hourlyRate || 0);
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        return res.status(400).json({ message: "The instructor does not have a valid hourly rate" });
      }
      const amount = Number((lesson.hours * hourlyRate).toFixed(3));
      lesson.status = "completed";
      lesson.hourlyRate = hourlyRate;
      lesson.hourlyRateSnapshot = hourlyRate;
      lesson.amountSnapshot = amount;
      await lesson.save();
      await Payment.updateOne(
        { lesson: lesson._id },
        {
          $set: { learner: plan.learner, instructor: plan.instructor, amount },
          $setOnInsert: { lesson: lesson._id, status: "unsubmitted" }
        },
        { upsert: true }
      );
      return res.json(lesson);
    }
    return res.status(400).json({ message: "Invalid lesson update" });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to update lesson" });
  }
});

module.exports = router;
