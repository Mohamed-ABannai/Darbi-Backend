const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    hashedPassword: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      maxLength: 8,
      minLength: 8,
      required: true
    },
    email: {
      type: String
    },
    role: {
      type: String,
      enum: ["learner", "instructor", "examiner", "admin"],
      default: "learner",
      required: true
    },
    availabilty: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: false
    },
    isApproved: {
      type: Boolean,
      default:false
    },
    hourlyRate: {
      type: Number
    },
    documents: {
      type: String
    },
    dateOfBirth:{
      type:Date
    }
  },
  { timestamps: true },
);


userSchema.set("toJSON", {
  transform: (document, returnedObject) => {
    delete returnedObject.hashedPassword;
  },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
