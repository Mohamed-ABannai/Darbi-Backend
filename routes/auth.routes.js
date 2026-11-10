const router = require("express").Router();

const bcrypt = require("bcrypt");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware/verifyToken");
const authorizeRoles = require("../middleware/authorizeRoles");

router.post("/sign-up", async (req, res) => {
  try {
    const { username, password, phone, email, dateOfBirth, role, documents } = req.body;

    // Validation
    if (!username || !password || !phone || !email || !dateOfBirth) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    if (role && !["learner", "instructor"].includes(role)) {
      return res.status(403).json({ message: "Invalid role." });
    }

    if (role === "instructor" && (!documents || !documents.data || !documents.contentType)) {
      return res.status(400).json({ message: "Instructor document is required." });
    }

    const user = await User.create({
      username: username.trim().toLowerCase(),
      hashedPassword: await bcrypt.hash(password, 12),
      phone,
      email,
      dateOfBirth,
      role: role || "learner",
      documents: role === "instructor" ? {
        data: Buffer.from(documents.data, "base64"),
        contentType: documents.contentType
      } : undefined,
      isApproved: false,
      isActive: true
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

router.post("/sign-in", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required.",
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
      expiresIn: "1h",
    });

    return res.status(200).json({
      accessToken,
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

router.post("/create-admin", verifyToken, authorizeRoles("superAdmin"), async (req, res) => {
  try {
    const { username, password, phone, email } = req.body;

    if (!username || !password || !phone || !email || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Valid admin details are required." });
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
    if (err.code === 11000) {
      return res.status(409).json({ message: "Username already exists" });
    }

    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    return res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;