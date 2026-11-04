const router = require("express").Router();
const verifyToken = require("../middleware/verifyToken");
const Payment = require("../models/Payment");
const TrainingPlan = require("../models/TrainingPlan");
const Lesson = require("../models/lesson");

router.get("/", verifyToken, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "learner") {
      filter = { Learner: req.user._id };
    } else if (req.user.role === "instructor") {
      filter = { instructor: req.user._id };
    } else if (req.user.role === "admin") {
      filter = {}; // Admin can see all payments
    }

    const allPayments = await Payment.find(filter)
      .populate("Learner")
      .populate("instructor");
    return res.status(200).json(allPayments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "learner") {
      return res
        .status(403)
        .json({ message: "Only learners can create payments." });
    }

    const { lesson, amount, method } = req.body;

    if (!lesson || !amount || !method) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const checkLesson = await Lesson.findById(lesson).populate("TrainingPlan");
    if (!checkLesson) {
      return res.status(404).json({ message: "Lesson not found." });
    }

    if (checkLesson.TrainingPlan.learner.toString() !== req.user._id) {
      return res
        .status(403)
        .json({ message: "You can only pay for your own lessons" });
    }

    const existingPayment = await Payment.findOne({
      lesson: lesson,
      status: "completed",
    });
    if (existingPayment) {
      return res
        .status(400)
        .json({ message: "This lesson is already paid for" });
    }

    const newPayment = await Payment.create({
      lesson,
      amount,
      method,
      Learner: req.user._id,
    });
    res.status(201).json(newPayment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.put("/:id", verifyToken, async (req, res) => {
    try {
        
    } catch (error) {
        
    }
})

module.exports = router;
