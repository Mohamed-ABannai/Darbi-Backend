const router = require("express").Router();
const DrivingTest = require("../models/DrivingTest");
const Lesson = require("../models/lesson");
const TrainingPlan = require("../models/TrainingPlan");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");

router.get("/", verifyToken, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "learner") {
      filter = { Learner: req.user._id };
    } else if (req.user.role === "instructor") {
      const plans = await TrainingPlan.find({ instructor: req.user._id });
      const learnerIds = plans.map((plan) => plan.learner);
      filter = { Learner: { $in: learnerIds } };
    } else if (
      req.user.role !== "admin" &&
      req.user.role !== "superAdmin" &&
      req.user.role !== "examiner"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const tests = await DrivingTest.find(filter)
      .populate("Learner", "username")
      .populate("examiner", "username")
      .sort({ date: -1 });

    return res.json(tests);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const test = await DrivingTest.findById(req.params.id)
      .populate("Learner", "username")
      .populate("examiner", "username");

    if (!test) {
      return res.status(404).json({ message: "Driving test not found" });
    }

    if (
      test.Learner._id.toString() === req.user._id.toString() ||
      req.user.role === "admin" ||
      req.user.role === "superAdmin" ||
      req.user.role === "examiner"
    ) {
      return res.json(test);
    }

    if (req.user.role === "instructor") {
      const hasPlan = await TrainingPlan.exists({
        instructor: req.user._id,
        learner: test.Learner._id
      });
      if (hasPlan) {
        return res.json(test);
      }
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

    const testDate = req.body.date || req.body.testDate;

    if (!testDate) {
      return res.status(400).json({ message: "Test date is required" });
    }

    const plans = await TrainingPlan.find({ learner: req.user._id });
    const planIds = plans.map((plan) => plan._id);

    const completedLessons = await Lesson.find({
      TrainingPlan: { $in: planIds },
      status: "completed"
    });

    const totalCompletedHours = completedLessons.reduce(
      (sum, lesson) => sum + lesson.hours,
      0
    );

    const failedTestsCount = await DrivingTest.countDocuments({
      Learner: req.user._id,
      result: "failed"
    });

    const requiredHours = 22 + failedTestsCount * 8;

    if (totalCompletedHours < requiredHours) {
      return res.status(400).json({
        message: `You need at least ${requiredHours} completed hours to book a driving test (current: ${totalCompletedHours} hrs).`
      });
    }

    const pendingTest = await DrivingTest.findOne({
      Learner: req.user._id,
      result: "pending"
    });

    if (pendingTest) {
      return res
        .status(400)
        .json({ message: "You already have a pending driving test" });
    }

    const newTest = await DrivingTest.create({
      Learner: req.user._id,
      date: testDate,
      status: "pending",
      result: "pending"
    });

    return res.status(201).json(newTest);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: err.message });
  }
});

router.put("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const test = await DrivingTest.findById(req.params.id);

    if (!test) {
      return res.status(404).json({ message: "Driving test not found" });
    }

    const testDate = req.body.date || req.body.testDate;
    const { status, result, examiner } = req.body;
    const updateData = {};

    if (req.user.role === "learner") {
      if (test.Learner.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (test.result !== "pending") {
        return res.status(400).json({ message: "Cannot modify a completed test" });
      }
      if (testDate) {
        updateData.date = testDate;
      }
    } else if (
      req.user.role === "admin" ||
      req.user.role === "superAdmin" ||
      req.user.role === "examiner"
    ) {
      if (testDate) updateData.date = testDate;
      if (examiner) updateData.examiner = examiner;
      if (req.user.role === "examiner" && !examiner) {
        updateData.examiner = req.user._id;
      }
      if (status) {
        if (!["pending", "scheduled", "completed", "cancelled"].includes(status)) {
          return res.status(400).json({ message: "Invalid test status" });
        }
        updateData.status = status;
      }
      if (result) {
        if (!["pending", "passed", "failed"].includes(result)) {
          return res.status(400).json({ message: "Invalid test result" });
        }
        updateData.result = result;
        if (result === "passed" || result === "failed") {
          updateData.status = "completed";
        }
        if (result === "failed") {
          updateData.extraHours = 8;
        }
      }
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    const updatedTest = await DrivingTest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    return res.json(updatedTest);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const test = await DrivingTest.findById(req.params.id);

    if (!test) {
      return res.status(404).json({ message: "Driving test not found" });
    }

    if (
      req.user.role === "learner" &&
      test.Learner.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (
      req.user.role !== "learner" &&
      req.user.role !== "admin" &&
      req.user.role !== "superAdmin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (test.result !== "pending") {
      return res.status(400).json({ message: "Only pending tests can be deleted" });
    }

    await DrivingTest.findByIdAndDelete(req.params.id);

    return res.json({ message: "Driving test cancelled successfully" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;