const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
    },
    amount: {
      type: Number,
    },
    method: {
      type: String,
      enum: ["Cash", "benefitPay", "bank transfer"],
    },
    status: {
      type: String,
      enum: ["pending", "completed", "rejected"],
      default: "pending",
    },
    cancellationRReason: {
      type: String,
    },
  },
  { timestamps: true },
);

const payment = mongoose.model("Payment", paymentSchema);
module.exports = payment;
