const router = require("express").Router();
const Review = require("../models/Review");
const TrainingPlan = require("../models/TrainingPlan");
const verifyToken = require("../middleware/verifyToken");

router.get("/", async (req, res) => {
  try {
    const allReviews = await Review.find().populate({
      path: "TrainingPlan",
      populate: [
        { path: "learner", select: "username" },
        { path: "instructor", select: "username" },
      ],
    });

    if (req.query.instructor) {
      const filteredReviews = allReviews.filter(
        (review) =>
          review.TrainingPlan &&
          review.TrainingPlan.instructor &&
          review.TrainingPlan.instructor._id == req.query.instructor
      );
      return res.status(200).json(filteredReviews);
    }

    return res.status(200).json(allReviews);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "learner") {
      return res.status(403).json({ message: "Only learners can create reviews." });
    }

    const { TrainingPlan: planId, rating, patience, raiseVoice, comment } = req.body;

    if (!planId || !rating || !patience) {
      return res.status(400).json({ message: "TrainingPlan, rating, and patience are required." });
    }

    const plan = await TrainingPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Training plan not found." });
    }

    if (plan.learner.toString() !== req.user._id) {
      return res.status(403).json({ message: "You can only review your own instructor." });
    }

    const existingReview = await Review.findOne({ TrainingPlan: planId });
    if (existingReview) {
      return res.status(400).json({ message: "You have already reviewed this training plan." });
    }

    const newReview = await Review.create({
      TrainingPlan: planId,
      rating,
      patience,
      raiseVoice,
      comment,
    });

    return res.status(201).json(newReview);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate("TrainingPlan");
    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    if (review.TrainingPlan.learner.toString() !== req.user._id) {
      return res.status(403).json({ message: "You can only edit your own review." });
    }

    const { rating, patience, raiseVoice, comment } = req.body;
    let updates = {};

    if (rating !== undefined) updates.rating = rating;
    if (patience !== undefined) updates.patience = patience;
    if (raiseVoice !== undefined) updates.raiseVoice = raiseVoice;
    if (comment !== undefined) updates.comment = comment;

    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    return res.status(200).json(updatedReview);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});


module.exports = router;
