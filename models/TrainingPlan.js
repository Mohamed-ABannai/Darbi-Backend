const mongoose = require("mongoose");

const trainingPlanSchema = new mongoose.Schema(
  {
    learner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    requestedLessons: [
      {
        date: { type: Date, required: true },
        hours: { type: Number, required: true, min: 1 }
      }
    ],
    status: {
      type: String,
      enum: ["pending", "active", "rejected", "cancelled", "transferred", "completed"],
      default: "pending"
    },
    reason: {
      type: String,
      minLength: 20,
      maxLength: 140
    }
  },
  { timestamps: true }
);

const TrainingPlan = mongoose.model("TrainingPlan", trainingPlanSchema);

module.exports = TrainingPlan;
