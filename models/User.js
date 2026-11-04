const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30
    },
    hashedPassword: {
      type: String,
      required: true,
      select: false
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\d{8}$/, "Phone number must contain exactly 8 digits"]
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"]
    },
    role: {
      type: String,
      enum: ["learner", "instructor", "examiner", "admin"],
      default: "learner",
      required: true
    },
    availability: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isApproved: {
      type: Boolean,
      default: false
    },
    hourlyRate: {
      type: Number,
      min: 22
    },
    documents: {
      type: String,
      trim: true
    },
    dateOfBirth: {
      type: Date,
      max: [Date.now, "Date of birth cannot be in the future"]
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
