const router = require("express").Router();

const bcrypt = require("bcrypt");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const verifyToken = require("../middleware/verifyToken");
const authorizeRoles = require("../middleware/authorizeRoles");
const { authLimiter } = require("../middleware/rateLimiters");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post("/sign-up", upload.single("documents"), async (req, res) => {
  try {
    const { username, password, phone, email, dateOfBirth, role } = req.body;

    // Validation
    if (!username || !password || !phone || !email || !dateOfBirth) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    if (role !== "learner" && role !== "instructor") {
      return res.status(403).json({ message: "Invalid role." });
    }

    if (role === "instructor") {
      if (!req.file) {
        return res.status(400).json({ message: "Instructor document is required." });
      }

      if (!["application/pdf", "image/jpeg", "image/png"].includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Invalid document type." });
      }
    }

    const user = await User.create({
      username: username.trim().toLowerCase(),
      hashedPassword: await bcrypt.hash(password, 12),
      phone,
      email,
      dateOfBirth,
      role,
      isApproved: false,
      isActive: true,
      documents: role === "instructor" ? {
        data: req.file.buffer,
        contentType: req.file.mimetype
      } : undefined
    });

    const { _id, createdAt } = user;

    return res.status(201).json({
      username: user.username,
      _id,
      createdAt,
      role: user.role
    });

  } catch (err) {
    console.log(err);

    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    if (err.code === 11000) {
      return res.status(409).json({ message: "Username already exists" });
    }

    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/sign-in", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required."
      });
    }

    const user = await User.findOne({
      username: username.toLowerCase().trim()
    }).select("+hashedPassword");

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.hashedPassword
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated." });
    }

    // Construct the payload
    const payload = {
      username: user.username,
      _id: user._id,
      role: user.role
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1h"
    });

    return res.status(200).json({
      accessToken,
      user: {
        _id: user._id,
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
});

router.post("/create-admin", verifyToken, authorizeRoles("superAdmin"), async (req, res) => {
  try {
    const { username, password, phone, email } = req.body;

    if (!username || !password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Valid username and password are required." });
    }

    const admin = await User.create({
      username: username.trim().toLowerCase(),
      hashedPassword: await bcrypt.hash(password, 12),
      phone,
      email,
      role: "admin",
      isActive: true
    });

    return res.status(201).json({
      message: "Admin created successfully",
      admin: {
        _id: admin._id,
        username: admin.username,
        role: admin.role
      }
    });

  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    if (err.code === 11000) {
      return res.status(409).json({ message: "Username already exists" });
    }

    return res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;