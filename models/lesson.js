const mongoose = require('mongoose');
const lessonSchema = new mongoose.Schema(
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
        hours: {
            type: Number,
            required: true,
            min:0
        },
        hourlyRate: {
            type: Number,
            min: 0,
        },
        hourlyRateSnapshot: { type: Number, min: 0 },
        amountSnapshot: { type: Number, min: 0 },
        status: {
            type: String,
            enum: ['pending', 'scheduled', 'completed', 'cancelled', 'rejected'],
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

const Lesson = mongoose.model('Lesson', lessonSchema);

module.exports = Lesson;
