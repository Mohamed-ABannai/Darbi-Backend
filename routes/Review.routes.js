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