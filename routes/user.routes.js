const router = require("express").Router();
const bcrypt = require("bcrypt");
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");
const authorizeRoles = require("../middleware/authorizeRoles");
const validateObjectId = require("../middleware/validateObjectId");
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.get("/examiners", verifyToken, authorizeRoles("admin", "superAdmin"), async (req, res) => {
  try {
    const examiners = await User.find({ role: "examiner" })
      .select("username email phone dateOfBirth isActive createdAt");
    return res.json(examiners);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Failed to load examiners" });
  }
});

router.post("/examiners", verifyToken, authorizeRoles("admin", "superAdmin"), async (req, res) => {
  try {
    const { username, password, phone, email, dateOfBirth } = req.body;

    if (!username || !password || !phone || !email || !dateOfBirth || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "All fields are required and password must be at least 6 characters." });
    }

    const examiner = await User.create({
      username: username.trim().toLowerCase(),
      hashedPassword: await bcrypt.hash(password, 12),
      phone,
      email,
      dateOfBirth,
      role: "examiner",
      isActive: true
    });

    return res.status(201).json({
      _id: examiner._id,
      username: examiner.username,
      email: examiner.email,
      phone: examiner.phone,
      dateOfBirth: examiner.dateOfBirth,
      role: examiner.role,
      isActive: examiner.isActive
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 11000) {
      return res.status(409).json({ message: "Username already exists" });
    }
    console.log(err);
    return res.status(500).json({ message: "Failed to create examiner" });
  }
});

router.get("/examiners/:id", verifyToken, authorizeRoles("admin", "superAdmin"), validateObjectId, async (req, res) => {
  try {
    const examiner = await User.findOne({ _id: req.params.id, role: "examiner" })
      .select("username email phone dateOfBirth isActive createdAt");
    if (!examiner) return res.status(404).json({ message: "Examiner not found" });
    return res.json(examiner);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Failed to load examiner" });
  }
});

router.patch("/examiners/:id/status", verifyToken, authorizeRoles("admin", "superAdmin"), validateObjectId, async (req, res) => {
  try {
    if (typeof req.body.isActive !== "boolean") {
      return res.status(400).json({ message: "A valid account status is required" });
    }
    const examiner = await User.findOneAndUpdate(
      { _id: req.params.id, role: "examiner" },
      { isActive: req.body.isActive },
      { new: true }
    ).select("username email phone dateOfBirth isActive createdAt");
    if (!examiner) return res.status(404).json({ message: "Examiner not found" });
    return res.json(examiner);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Failed to update examiner status" });
  }
});

router.get("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role == "admin" || req.user.role == "superAdmin") {
      const allUsers = await User.find()
        .select("-profileImage.data -documents.data");

      return res.json(allUsers);
    }
    else if (req.user.role == "learner") {
      const allInstructors = await User.find({
        role: "instructor",
        isApproved: true,
        isActive: true
      }).select("username availability hourlyRate");

      return res.json(allInstructors);
    }
    else {
      return res.status(403).json({ message: "Access denied" });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id/image", verifyToken, validateObjectId, async (req, res) => {
  try {
    const foundUser = await User.findById(req.params.id);

    if (!foundUser || !foundUser.profileImage || !foundUser.profileImage.data) {
      return res.status(404).json({ message: "Image not found" });
    }

    res.set("Content-Type", foundUser.profileImage.contentType);
    return res.send(foundUser.profileImage.data);

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id/documents", verifyToken, validateObjectId, async (req, res) => {
  try {
    if (
      req.user._id != req.params.id &&
      req.user.role != "admin" &&
      req.user.role != "superAdmin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const foundUser = await User.findById(req.params.id);

    if (!foundUser || !foundUser.documents || !foundUser.documents.data) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.set("Content-Type", foundUser.documents.contentType);
    return res.send(foundUser.documents.data);

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const foundUser = await User.findById(req.params.id)
      .select("-profileImage.data -documents.data");

    if (!foundUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      req.user._id == req.params.id ||
      req.user.role == "admin" ||
      req.user.role == "superAdmin"
    ) {
      return res.json(foundUser);
    }
    else if (
      foundUser.role == "instructor" &&
      foundUser.isApproved &&
      foundUser.isActive
    ) {
      return res.json({
        _id: foundUser._id,
        username: foundUser.username,
        availability: foundUser.availability,
        hourlyRate: foundUser.hourlyRate
      });
    }
    else {
      return res.status(403).json({ message: "Access denied" });
    }

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", verifyToken, validateObjectId, upload.single("profileImage"), async (req, res) => {
  try {
    const foundUser = await User.findById(req.params.id);

    if (!foundUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (req.user._id == req.params.id) {
      const { phone, email, dateOfBirth } = req.body;

      const updateData = {};

      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;

      if (req.file) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)) {
          return res.status(400).json({ message: "Invalid image type" });
        }

        updateData.profileImage = {
          data: req.file.buffer,
          contentType: req.file.mimetype
        };
      }

      if (foundUser.role == "instructor") {
        if (req.body.availability !== undefined) {
          updateData.availability = req.body.availability;
        }

        if (req.body.hourlyRate !== undefined) {
          updateData.hourlyRate = req.body.hourlyRate;
        }
      }

      await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      return res.json({ message: "Profile updated successfully" });
    }
    else if (req.user.role == "admin" || req.user.role == "superAdmin") {
      if (
        req.user.role == "admin" &&
        (foundUser.role == "admin" || foundUser.role == "superAdmin")
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (foundUser.role == "superAdmin") {
        return res.status(403).json({ message: "Cannot manage SuperAdmin" });
      }

      const updateData = {};

      if (req.body.isActive !== undefined) {
        updateData.isActive =
          req.body.isActive === true || req.body.isActive === "true";
      }

      if (foundUser.role == "instructor" && req.body.isApproved !== undefined) {
        updateData.isApproved =
          req.body.isApproved === true || req.body.isApproved === "true";
      }

      await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      return res.json({ message: "User updated successfully" });
    }
    else {
      return res.status(403).json({ message: "You cannot edit this user" });
    }

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", verifyToken, validateObjectId, async (req, res) => {
  try {
    const foundUser = await User.findById(req.params.id);

    if (!foundUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (foundUser.role == "superAdmin") {
      return res.status(403).json({ message: "Cannot deactivate SuperAdmin" });
    }

    if (req.user.role == "admin" && foundUser.role == "admin") {
      return res.status(403).json({ message: "Cannot deactivate another admin" });
    }

    if (
      req.user._id == req.params.id ||
      req.user.role == "admin" ||
      req.user.role == "superAdmin"
    ) {
      await User.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );

      return res.json({ message: "User deactivated successfully" });
    }
    else {
      return res.status(403).json({ message: "You cannot delete this user" });
    }

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
