const router = require("express").Router();
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");

router.get("/", verifyToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);

    if (!currentUser || !currentUser.isActive) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (currentUser.role == "admin") {
      const allUsers = await User.find();
      return res.json(allUsers);
    }
    else if (currentUser.role == "learner") {
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
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", verifyToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const foundUser = await User.findById(req.params.id);

    if (!foundUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!currentUser || !currentUser.isActive) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.user._id == req.params.id || currentUser.role == "admin") {
      return res.json(foundUser);
    }
    else if (foundUser.role == "instructor" && foundUser.isApproved && foundUser.isActive) {
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
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const foundUser = await User.findById(req.params.id);

    if (!foundUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!currentUser || !currentUser.isActive) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.user._id == req.params.id) {
      const { phone, email, dateOfBirth } = req.body;

      const updateData = {
        phone,
        email,
        dateOfBirth
      };

      if (foundUser.role == "instructor") {
        updateData.availability = req.body.availability;
        updateData.hourlyRate = req.body.hourlyRate;
        updateData.documents = req.body.documents;
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      return res.json(updatedUser);
    }
    else if (currentUser.role == "admin") {
      const { isActive, isApproved } = req.body;

      const updateData = {
        isActive
      };

      if (foundUser.role == "instructor") {
        updateData.isApproved = isApproved;
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      return res.json(updatedUser);
    }
    else {
      return res.status(403).json({ message: "You cannot edit this user" });
    }

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const foundUser = await User.findById(req.params.id);

    if (!foundUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!currentUser || !currentUser.isActive) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.user._id == req.params.id || currentUser.role == "admin") {
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );

      return res.json(updatedUser);
    }
    else {
      return res.status(403).json({ message: "You cannot delete this user" });
    }

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
