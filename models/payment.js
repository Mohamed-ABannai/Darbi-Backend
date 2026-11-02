const mongoose = require('mongoose');


const paymentSchema = new mongoose.Schema(
    {
        lesson: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Lesson',
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        method: {
            type: String,
            enum: ['cash', 'benefitpay', 'banktransfer'],
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'rejected', 'confirmed'],
            default: 'pending',
        },
        cancellationReason: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
