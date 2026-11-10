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
      trim: true
    },

    email: {
      type: String,
      trim: true,
      lowercase: true
    },

    role: {
      type: String,
      enum: ["learner", "instructor", "examiner", "admin", "superAdmin"],
      default: "learner",
      required: true
    },

    profileImage: {
      data: Buffer,
      contentType: String
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
      data: Buffer,
      contentType: String
    },

    dateOfBirth: {
      type: Date
    }
  },
  { timestamps: true }
);

userSchema.set("toJSON", {
  transform: (document, returnedObject) => {
    delete returnedObject.hashedPassword;
  }
});

const User = mongoose.model("User", userSchema);

module.exports = User;