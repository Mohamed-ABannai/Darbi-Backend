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

    weeklySchedule: [
      {
        day: String,
        startTime: String,
        endTime: String
      }
    ],

    status: {
      type: String,
      enum: [
        "pending",
        "active",
        "rejected",
        "cancelled",
        "transferred",
        "completed"
      ],
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
