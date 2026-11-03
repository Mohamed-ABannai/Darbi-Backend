const router = require("express").Router();
const DrivingTest = require("../models/DrivingTest");
const User = require("../models/User");
const Lesson = require("../models/lesson");
const verifyToken = require("../middleware/verifyToken");
const TrainingPlan = require("../models/TrainingPlan");

router.get("/", verifyToken, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "learner") {
      filter = { Learner: req.user._id };
    } else if (req.user.role === "examiner") {
      filter = { examiner: req.user._id };
    }

    const allDrivingTests = await DrivingTest.find(filter)
      .populate("Learner")
      .populate("examiner");
    return res.status(200).json(allDrivingTests);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "learner") {
      return res
        .status(403)
        .json({ message: "Only learners can request a driving test" });
    }
    const { date } = req.body;
    if (!date) {
      return res
        .status(400)
        .json({ message: "Please provide a date for the test" });
    }

    const plan = await TrainingPlan.findOne({
      learner: req.user._id,
      status: "active",
    });

    if (!plan) {
      return res.status(404).json({ message: "No active training plan found" });
    }

    const completedLessons = await Lesson.find({
      TrainingPlan: plan._id,
      status: "completed",
    });
    let totalHours = 0;
    for (let lesson of completedLessons) {
      totalHours += lesson.hours;
    }
    // check if the leaner has failed before
    const previousFails = await DrivingTest.find({
      Learner: req.user._id,
      result: "failed",
    });

    const requiredHours = 22 + previousFails.length * 8;

    if (totalHours < requiredHours) {
      return res.status(400).json({
        message: `You completed ${totalHours} hours out of ${requiredHours} required hours.`,
      });
    }

    const newTest = await DrivingTest.create({
      Learner: req.user._id,
      date: date,
      status: "pending",
      result: "pending",
      extraHours: 0,
    });
    res.status(201).json(newTest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const test = await DrivingTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ message: "Driving test not found" });
    }

    if (test.status === "completed") {
      return res
        .status(400)
        .json({ message: "Cannot modify a completed test" });
    }

    if (req.user.role === "learner") {
      if (test.Learner != req.user._id) {
        return res.status(403).json({ message: "You cannot edit this test" });
      }

      const cancelledTest = await DrivingTest.findByIdAndUpdate(
        req.params.id,
        { status: "cancelled" },
        { new: true },
      );
      return res.status(200).json(cancelledTest);
    }

    let updateData = { ...req.body };

    if (req.body.result) {
      updateData.status = "completed";
      if (req.body.result === "failed") {
        updateData.extraHours = 8;
      } else if (req.body.result === "passed") {
        updateData.extraHours = 0;
      }
    }

    const updatedTest = await DrivingTest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true },
    );

    return res.status(200).json(updatedTest);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
