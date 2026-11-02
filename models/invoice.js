const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
    {
        TrainingPlan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TrainingPlan',
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'paid', 'overdue'],
            default: 'pending',
        },
    },
    {
        timestamps: true,
    }
);

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;