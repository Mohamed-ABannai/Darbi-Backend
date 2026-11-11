const router = require("express").Router();
const DrivingTest = require("../models/DrivingTest");
const Lesson = require("../models/lesson");
const TrainingPlan = require("../models/TrainingPlan");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");
const User = require("../models/User");

router.get("/", verifyToken, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role == "learner") {
      filter = { Learner: req.user._id };
    }
    else if (req.user.role == "examiner") {
      filter = { examiner: req.user._id };
    }
    else if (
      req.user.role != "admin" &&
      req.user.role != "superAdmin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const allDrivingTests = await DrivingTest.find(filter)
      .populate("Learner", "username")
      .populate("examiner", "username");

    return res.json(allDrivingTests);

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role != "learner") {
      return res.status(403).json({
        message: "Only learners can request driving tests"
      });
    }

    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const activePlan = await TrainingPlan.findOne({
      learner: req.user._id,
      status: "active"
    });

    if (!activePlan) {
      return res.status(400).json({
        message: "You need an active training plan"
      });
    }

    const existingTest = await DrivingTest.findOne({
      Learner: req.user._id,
      status: { $in: ["pending", "scheduled"] }
    });

    if (existingTest) {
      return res.status(400).json({
        message: "You already have a pending or scheduled test"
      });
    }

    const trainingPlans = await TrainingPlan.find({
      learner: req.user._id
    });

    const planIds = trainingPlans.map((plan) => plan._id);

    const completedLessons = await Lesson.find({
      TrainingPlan: { $in: planIds },
      status: "completed"
    });

    let totalHours = 0;

    for (const lesson of completedLessons) {
      totalHours += lesson.hours;
    }

    const previousFails = await DrivingTest.find({
      Learner: req.user._id,
      result: "failed"
    });

    const requiredHours = 22 + previousFails.length * 8;

    if (totalHours < requiredHours) {
      return res.status(400).json({
        message: `You completed ${totalHours} out of ${requiredHours} required hours`
      });
    }

    const newTest = await DrivingTest.create({
      Learner: req.user._id,
      date: date,
      status: "pending",
      result: "pending"
    });

    return res.status(201).json(newTest);

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const test = await DrivingTest.findById(req.params.id);

    if (!test) {
      return res.status(404).json({ message: "Driving test not found" });
    }

    if (test.status == "completed" || test.status == "cancelled") {
      return res.status(400).json({
        message: "Cannot update this test"
      });
    }

    if (req.user.role == "learner") {
      if (test.Learner != req.user._id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const cancelledTest = await DrivingTest.findByIdAndUpdate(
        req.params.id,
        { status: "cancelled" },
        { new: true }
      );

      return res.json(cancelledTest);
    }

    else if (
      req.user.role == "admin" ||
      req.user.role == "superAdmin"
    ) {
      if (test.status != "pending") {
        return res.status(400).json({
          message: "Only pending tests can be scheduled"
        });
      }

      const { examiner, date } = req.body;

      if (!examiner || !date) {
        return res.status(400).json({
          message: "Examiner and date are required"
        });
      }

      const foundExaminer = await User.findById(examiner);

      if (
        !foundExaminer ||
        foundExaminer.role != "examiner" ||
        !foundExaminer.isActive
      ) {
        return res.status(400).json({
          message: "Invalid examiner"
        });
      }

      const updatedTest = await DrivingTest.findByIdAndUpdate(
        req.params.id,
        {
          examiner: examiner,
          date: date,
          status: "scheduled"
        },
        { new: true, runValidators: true }
      );

      return res.json(updatedTest);
    }

    else if (req.user.role == "examiner") {
      if (test.examiner != req.user._id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (test.status != "scheduled") {
        return res.status(400).json({
          message: "Test must be scheduled"
        });
      }

      const { result } = req.body;

      if (result != "passed" && result != "failed") {
        return res.status(400).json({
          message: "Result must be passed or failed"
        });
      }

      const updatedTest = await DrivingTest.findByIdAndUpdate(
        req.params.id,
        {
          result: result,
          status: "completed",
          extraHours: result == "failed" ? 8 : 0
        },
        { new: true }
      );

      return res.json(updatedTest);
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