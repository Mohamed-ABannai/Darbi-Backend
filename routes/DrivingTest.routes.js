const router = require("express").Router();
const DrivingTest = require("../models/DrivingTest");
const Lesson = require("../models/lesson");
const TrainingPlan = require("../models/TrainingPlan");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");
const User = require("../models/User");

router.get("/eligibility", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "learner") return res.status(403).json({ message: "Learners only" });
    const plans = await TrainingPlan.find({ learner: req.user._id });
    const planIds = plans.map((plan) => plan._id);
    const completedLessons = await Lesson.find({ TrainingPlan: { $in: planIds }, status: "completed" });
    const totalHours = completedLessons.reduce((total, lesson) => total + Number(lesson.hours || 0), 0);
    const previousFails = await DrivingTest.countDocuments({ Learner: req.user._id, result: "failed" });
    const requiredHours = 22 + previousFails * 8;
    const activeTest = await DrivingTest.exists({ Learner: req.user._id, status: { $in: ["pending", "scheduled"] } });
    const hasActivePlan = plans.some((plan) => plan.status === "active");
    return res.json({ totalHours, requiredHours, remainingHours: Math.max(0, requiredHours - totalHours), eligible: totalHours >= requiredHours && hasActivePlan && !activeTest, hasActivePlan, hasActiveTest: Boolean(activeTest) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to check driving test eligibility" });
  }
});

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

    const testDate = new Date(date);
    if (!date || Number.isNaN(testDate.getTime()) || testDate <= new Date()) return res.status(400).json({ message: "Choose a valid future test date" });

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

    const hasActivePlan = trainingPlans.some((plan) => plan.status === "active");
    if (!hasActivePlan) {
      return res.status(400).json({ message: "An active training plan is required to request a driving test" });
    }

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

    const examiners = await User.find({ role: "examiner", isActive: true }).select("_id");
    const availableExaminers = [];
    for (const examiner of examiners) {
      const conflict = await DrivingTest.exists({ examiner: examiner._id, status: "scheduled", date: testDate });
      if (!conflict) availableExaminers.push(examiner);
    }
    if (availableExaminers.length === 0) return res.status(409).json({ message: "No eligible examiners are available at that time" });
    const assignedExaminer = availableExaminers[Math.floor(Math.random() * availableExaminers.length)];
    const newTest = await DrivingTest.create({
      Learner: req.user._id,
      examiner: assignedExaminer._id,
      date: testDate,
      status: "scheduled",
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

      if (req.body.status !== "cancelled") {
        return res.status(400).json({ message: "Learners can only cancel their driving tests" });
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

      const testDate = new Date(date);
      if (Number.isNaN(testDate.getTime()) || testDate <= new Date()) {
        return res.status(400).json({ message: "Choose a valid future test date" });
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

      const existingTest = await DrivingTest.findOne({
        _id: { $ne: test._id },
        examiner,
        date: testDate,
        status: "scheduled"
      });
      if (existingTest) {
        return res.status(409).json({ message: "The examiner already has a test at that time" });
      }

      const updatedTest = await DrivingTest.findByIdAndUpdate(
        req.params.id,
        {
          examiner: examiner,
          date: testDate,
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
