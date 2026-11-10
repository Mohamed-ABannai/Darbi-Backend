const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    method: {
      type: String,
      enum: ["Cash", "benefitPay", "bank transfer"],
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "completed", "rejected"],
      default: "pending"
    },

    cancellationReason: {
      type: String
    }
  },
  { timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;