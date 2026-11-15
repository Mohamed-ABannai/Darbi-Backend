const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: true
    },
    learner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    method: {
      type: String,
      enum: ["Cash", "benefitPay", "bank transfer"],
      required: false
    },

    status: {
      type: String,
      enum: ["unsubmitted", "pending", "completed", "rejected"],
      default: "unsubmitted"
    },

    cancellationReason: {
      type: String
    }
  },
  { timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
