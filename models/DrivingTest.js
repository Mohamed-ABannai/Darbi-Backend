const mongoose = require("mongoose");

const DrivingTestSchema = new mongoose.Schema(
  {
    Learner:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    examiner:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    status:{
        type: String,
        enum: ["pending", "scheduled" , "completed", "cancelled"]
    },
    result:{
        type: String,
        enum:[ "pending" , "passed" , "failed"]
    },
    extraHours:{
        type: Number,
        default: 0
    }
  },
  { timestamps: true },
);

const DrivingTest = mongoose.model("DrivingTest", DrivingTestSchema);
module.exports = DrivingTest;
