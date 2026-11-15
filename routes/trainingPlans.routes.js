const router = require("express").Router();
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");
const TrainingPlan = require("../models/TrainingPlan");
const Lesson = require("../models/lesson");
const User = require("../models/User");

router.get("/", verifyToken, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "learner") filter = { learner: req.user._id };
    else if (req.user.role === "instructor") filter = { instructor: req.user._id };
    else if (req.user.role !== "admin" && req.user.role !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const trainingPlans = await TrainingPlan.find(filter)
      .populate("learner", "username")
      .populate("instructor", "username hourlyRate")
      .sort({ createdAt: -1 });

    return res.json(trainingPlans);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const foundPlan = await TrainingPlan.findById(req.params.id)
      .populate("learner", "username")
      .populate("instructor", "username hourlyRate");

    if (!foundPlan) {
      return res.status(404).json({ message: "Training plan not found" });
    }

    if (
      foundPlan.learner._id.toString() === req.user._id.toString() ||
      foundPlan.instructor._id.toString() === req.user._id.toString() ||
      req.user.role === "admin" ||
      req.user.role === "superAdmin"
    ) {
      return res.json(foundPlan);
    }
    return res.status(403).json({ message: "Access denied" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "learner") {
      return res.status(403).json({ message: "Learners only" });
    }

    const { instructor, requestedLessons } = req.body;

    if (!instructor || !Array.isArray(requestedLessons) || requestedLessons.length !== 3) {
      return res.status(400).json({ message: "Please select 3 separate lesson dates and times." });
    }

    const uniqueTimestamps = new Set(requestedLessons.map((l) => new Date(l.date).getTime()));
    if (uniqueTimestamps.size !== 3 || requestedLessons.some((l) => !l.date || !l.hours || l.hours <= 0)) {
      return res.status(400).json({ message: "All 3 lessons must have distinct valid dates and positive hours." });
    }

    const foundInstructor = await User.findById(instructor);
    if (!foundInstructor || foundInstructor.role !== "instructor" || !foundInstructor.isApproved || !foundInstructor.isActive) {
      return res.status(400).json({ message: "Instructor not available" });
    }

    const newTrainingPlan = await TrainingPlan.create({
      learner: req.user._id,
      instructor,
      requestedLessons,
      status: "pending"
    });

    return res.status(201).json(newTrainingPlan);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const trainingPlan = await TrainingPlan.findById(req.params.id);
    if (!trainingPlan) {
      return res.status(404).json({ message: "Training plan not found" });
    }

    // Instructor Accept / Reject
    if (req.user.role === "instructor" && trainingPlan.instructor.toString() === req.user._id.toString()) {
      if (trainingPlan.status !== "pending" || (req.body.status !== "active" && req.body.status !== "rejected")) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const updatedPlan = await TrainingPlan.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status, reason: req.body.reason },
        { new: true, runValidators: true }
      );

      // Auto-schedule the 3 selected lessons upon acceptance
      if (req.body.status === "active" && Array.isArray(trainingPlan.requestedLessons)) {
        const lessonsToCreate = trainingPlan.requestedLessons.map((item) => ({
          TrainingPlan: trainingPlan._id,
          date: item.date,
          hours: item.hours,
          status: "scheduled"
        }));
        await Lesson.insertMany(lessonsToCreate);
      }

      return res.json(updatedPlan);
    }

    // Learner Cancel / Transfer
    if (req.user.role === "learner" && trainingPlan.learner.toString() === req.user._id.toString()) {
      if (req.body.status === "cancelled") {
        if (trainingPlan.status !== "pending" && trainingPlan.status !== "active") {
          return res.status(400).json({ message: "Cannot cancel this plan" });
        }
        if (!req.body.reason) {
          return res.status(400).json({ message: "Reason is required" });
        }

        const updatedPlan = await TrainingPlan.findByIdAndUpdate(
          req.params.id,
          { status: "cancelled", reason: req.body.reason },
          { new: true, runValidators: true }
        );
        return res.json(updatedPlan);
      }

      if (req.body.instructor) {
        if (trainingPlan.status !== "active") {
          return res.status(400).json({ message: "Plan must be active" });
        }
        const foundInstructor = await User.findById(req.body.instructor);
        if (!foundInstructor || foundInstructor.role !== "instructor" || !foundInstructor.isApproved || !foundInstructor.isActive || trainingPlan.instructor.toString() === req.body.instructor) {
          return res.status(400).json({ message: "Invalid instructor" });
        }

        const newPlan = await TrainingPlan.create({
          learner: req.user._id,
          instructor: req.body.instructor,
          requestedLessons: trainingPlan.requestedLessons,
          status: "pending"
        });

        await TrainingPlan.findByIdAndUpdate(req.params.id, { status: "transferred" });
        return res.json(newPlan);
      }

      return res.status(400).json({ message: "Invalid update" });
    }

    return res.status(403).json({ message: "You cannot edit this training plan" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;