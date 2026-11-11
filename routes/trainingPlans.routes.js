const router = require("express").Router();
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");
const TrainingPlan = require("../models/TrainingPlan");
const User = require("../models/User");

router.get("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role == "learner") {
      const trainingPlans = await TrainingPlan.find({
        learner: req.user._id
      })
        .populate("learner", "username")
        .populate("instructor", "username hourlyRate");

      return res.json(trainingPlans);
    }
    else if (req.user.role == "instructor") {
      const trainingPlans = await TrainingPlan.find({
        instructor: req.user._id
      })
        .populate("learner", "username")
        .populate("instructor", "username hourlyRate");

      return res.json(trainingPlans);
    }
    else if (
      req.user.role == "admin" ||
      req.user.role == "superAdmin"
    ) {
      const trainingPlans = await TrainingPlan.find()
        .populate("learner", "username")
        .populate("instructor", "username hourlyRate");

      return res.json(trainingPlans);
    }
    else {
      return res.status(403).json({ message: "Access denied" });
    }

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const trainingPlan = await TrainingPlan.findById(req.params.id);

    if (!trainingPlan) {
      return res.status(404).json({ message: "Training plan not found" });
    }

    if (
      trainingPlan.learner == req.user._id ||
      trainingPlan.instructor == req.user._id ||
      req.user.role == "admin" ||
      req.user.role == "superAdmin"
    ) {
      const foundPlan = await TrainingPlan.findById(req.params.id)
        .populate("learner", "username")
        .populate("instructor", "username hourlyRate");

      return res.json(foundPlan);
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

    const { instructor, weeklySchedule } = req.body;

    if (
      !instructor ||
      !Array.isArray(weeklySchedule) ||
      weeklySchedule.length == 0
    ) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const foundInstructor = await User.findById(instructor);

    if (
      !foundInstructor ||
      foundInstructor.role != "instructor" ||
      !foundInstructor.isApproved ||
      !foundInstructor.isActive
    ) {
      return res.status(400).json({ message: "Instructor not available" });
    }

    const newTrainingPlan = await TrainingPlan.create({
      learner: req.user._id,
      instructor: instructor,
      weeklySchedule: weeklySchedule,
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

    if (
      req.user.role == "instructor" &&
      trainingPlan.instructor == req.user._id
    ) {
      if (
        trainingPlan.status != "pending" ||
        (req.body.status != "active" && req.body.status != "rejected")
      ) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const updatedPlan = await TrainingPlan.findByIdAndUpdate(
        req.params.id,
        {
          status: req.body.status,
          reason: req.body.reason
        },
        { new: true, runValidators: true }
      );

      return res.json(updatedPlan);
    }
    else if (
      req.user.role == "learner" &&
      trainingPlan.learner == req.user._id
    ) {
      if (req.body.status == "cancelled") {
        if (
          trainingPlan.status != "pending" &&
          trainingPlan.status != "active"
        ) {
          return res.status(400).json({ message: "Cannot cancel this plan" });
        }

        if (!req.body.reason) {
          return res.status(400).json({ message: "Reason is required" });
        }

        const updatedPlan = await TrainingPlan.findByIdAndUpdate(
          req.params.id,
          {
            status: "cancelled",
            reason: req.body.reason
          },
          { new: true, runValidators: true }
        );

        return res.json(updatedPlan);
      }
      else if (req.body.instructor) {
        if (trainingPlan.status != "active") {
          return res.status(400).json({ message: "Plan must be active" });
        }

        const foundInstructor = await User.findById(req.body.instructor);

        if (
          !foundInstructor ||
          foundInstructor.role != "instructor" ||
          !foundInstructor.isApproved ||
          !foundInstructor.isActive ||
          trainingPlan.instructor == req.body.instructor
        ) {
          return res.status(400).json({ message: "Invalid instructor" });
        }

        const newPlan = await TrainingPlan.create({
          learner: req.user._id,
          instructor: req.body.instructor,
          weeklySchedule: trainingPlan.weeklySchedule,
          status: "pending"
        });

        const oldPlan = await TrainingPlan.findByIdAndUpdate(
          req.params.id,
          { status: "transferred" },
          { new: true }
        );

        return res.json(newPlan);
      }
      else if (req.body.weeklySchedule && trainingPlan.status == "pending") {
        if (
          !Array.isArray(req.body.weeklySchedule) ||
          req.body.weeklySchedule.length == 0
        ) {
          return res.status(400).json({ message: "Invalid weekly schedule" });
        }

        const updatedPlan = await TrainingPlan.findByIdAndUpdate(
          req.params.id,
          { weeklySchedule: req.body.weeklySchedule },
          { new: true, runValidators: true }
        );

        return res.json(updatedPlan);
      }
      else {
        return res.status(400).json({ message: "Invalid update" });
      }
    }
    else {
      return res.status(403).json({
        message: "You cannot edit this training plan"
      });
    }

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;