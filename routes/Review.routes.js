const router = require("express").Router();
const Review = require("../models/Review");
const TrainingPlan = require("../models/TrainingPlan");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");


router.get("/", async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("TrainingPlan");

    return res.json(reviews);

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});


router.get("/:id", validateObjectId, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate("TrainingPlan");

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    return res.json(review);

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

    const { TrainingPlan: planId, rating, patience, raiseVoice, comment } = req.body;

    if (!planId || rating == null || patience == null) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const plan = await TrainingPlan.findById(planId);

    if (!plan) {
      return res.status(404).json({ message: "Training plan not found" });
    }

    if (plan.learner != req.user._id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const existingReview = await Review.findOne({
      TrainingPlan: planId
    });

    if (existingReview) {
      return res.status(400).json({
        message: "You already reviewed this training plan"
      });
    }

    const newReview = await Review.create({
      TrainingPlan: planId,
      rating,
      patience,
      raiseVoice,
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
    if (req.user.role != "learner") {
      return res.status(403).json({ message: "Learners only" });
    }

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const plan = await TrainingPlan.findById(review.TrainingPlan);

    if (!plan || plan.learner != req.user._id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { rating, patience, raiseVoice, comment } = req.body;

    const updateData = {};

    if (rating !== undefined) updateData.rating = rating;
    if (patience !== undefined) updateData.patience = patience;
    if (raiseVoice !== undefined) updateData.raiseVoice = raiseVoice;
    if (comment !== undefined) updateData.comment = comment;

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
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const plan = await TrainingPlan.findById(review.TrainingPlan);

    if (
      (!plan || plan.learner != req.user._id) &&
      req.user.role != "admin" &&
      req.user.role != "superAdmin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const deletedReview = await Review.findByIdAndDelete(req.params.id);

    return res.json(deletedReview);

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;