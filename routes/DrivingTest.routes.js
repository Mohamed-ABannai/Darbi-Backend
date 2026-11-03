const router = require("express").Router();
const DrivingTest = require("../models/DrivingTest");
const User = require("../models/User");
const Lesson = require("../models/lesson");
const verifyToken = require("../middleware/verifyToken");

router.get("/", verifyToken, async (req, res) => {
  try {
    const allDrivingTests = await DrivingTest.find()
      .populate("Learner")
      .populate("examiner");
    res.status(200).json(allDrivingTests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const { Learner, examiner, date, status, result, extraHours } = req.body;
    const newDrivingTest = await DrivingTest.create({
      Learner,
      examiner,
      date,
      status,
      result,
      extraHours,
    });
    res.status(201).json(newDrivingTest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
