const router = require("express").Router();
const Review = require("../models/Review");
const TrainingPlan = require("../models/TrainingPlan");
const Lesson = require("../models/lesson");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");

router.get("/", verifyToken, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "learner") {
      const plans = await TrainingPlan.find({ learner: req.user._id });
      const planIds = plans.map((p) => p._id);
      filter = { TrainingPlan: { $in: planIds } };
    } else if (req.user.role === "instructor") {
      const plans = await TrainingPlan.find({ instructor: req.user._id });
      const planIds = plans.map((p) => p._id);
      filter = { TrainingPlan: { $in: planIds } };
    } else if (req.user.role !== "admin" && req.user.role !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const reviews = await Review.find(filter)
      .populate({
        path: "TrainingPlan",
        populate: [
          { path: "learner", select: "username" },
          { path: "instructor", select: "username" }
        ]
      })
      .sort({ createdAt: -1 });

    return res.json(reviews);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/instructor/:instructorId", verifyToken, async (req, res) => {
  try {
    const plans = await TrainingPlan.find({
      instructor: req.params.instructorId
    });
    const planIds = plans.map((p) => p._id);

    const reviews = await Review.find({ TrainingPlan: { $in: planIds } })
      .populate({
        path: "TrainingPlan",
        populate: { path: "learner", select: "username" }
      })
      .sort({ createdAt: -1 });

    return res.json(reviews);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate({
      path: "TrainingPlan",
      populate: [
        { path: "learner", select: "username" },
        { path: "instructor", select: "username" }
      ]
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const plan = review.TrainingPlan;

    if (
      plan?.learner?._id?.toString() === req.user._id.toString() ||
      plan?.instructor?._id?.toString() === req.user._id.toString() ||
      req.user.role === "admin" ||
      req.user.role === "superAdmin"
    ) {
      return res.json(review);
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

    const planId = req.body.TrainingPlan || req.body.trainingPlan;
    const { rating, patience, raiseVoice, comment } = req.body;

    if (!planId || !rating || !patience) {
      return res
        .status(400)
        .json({ message: "Training plan, rating, and patience are required" });
    }

    if (
      Number(rating) < 1 ||
      Number(rating) > 5 ||
      Number(patience) < 1 ||
      Number(patience) > 5
    ) {
      return res
        .status(400)
        .json({ message: "Rating and patience must be between 1 and 5" });
    }

    const plan = await TrainingPlan.findById(planId);

    if (!plan) {
      return res.status(404).json({ message: "Training plan not found" });
    }

    if (plan.learner.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "You can only review your own training plans" });
    }

    const completedLessonCount = await Lesson.countDocuments({
      TrainingPlan: planId,
      status: "completed"
    });

    if (completedLessonCount === 0) {
      return res.status(400).json({
        message: "You can only review an instructor after completing at least one lesson."
      });
    }

    const existingReview = await Review.findOne({ TrainingPlan: planId });

    if (existingReview) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this training plan" });
    }

    const newReview = await Review.create({
      TrainingPlan: planId,
      rating: Number(rating),
      patience: Number(patience),
      raiseVoice: Boolean(raiseVoice),
      comment
    });

    return res.status(201).json(newReview);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: err.message });
  }
});

router.put("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate("TrainingPlan");

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (
      req.user.role !== "learner" ||
      review.TrainingPlan?.learner?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { rating, patience, raiseVoice, comment } = req.body;
    const updateData = {};

    if (rating !== undefined) {
      if (Number(rating) < 1 || Number(rating) > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }
      updateData.rating = Number(rating);
    }

    if (patience !== undefined) {
      if (Number(patience) < 1 || Number(patience) > 5) {
        return res.status(400).json({ message: "Patience must be between 1 and 5" });
      }
      updateData.patience = Number(patience);
    }

    if (raiseVoice !== undefined) {
      updateData.raiseVoice = Boolean(raiseVoice);
    }

    if (comment !== undefined) {
      updateData.comment = comment;
    }

    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    return res.json(updatedReview);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate("TrainingPlan");

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (
      review.TrainingPlan?.learner?.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "superAdmin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    await Review.findByIdAndDelete(req.params.id);

    return res.json({ message: "Review deleted successfully" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;