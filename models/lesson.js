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
        status: {
            type: String,
            enum: ['scheduled', 'completed', 'cancelled'],
            default: 'scheduled',
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