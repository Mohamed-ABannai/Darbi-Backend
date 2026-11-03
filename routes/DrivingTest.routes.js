const router = require("express").Router();
const DrivingTest = require("../models/DrivingTest");
const User = require("../models/User");
const Lesson = require("../models/lesson");
const verifyToken = require("../middleware/verifyToken");

router.get("/", verifyToken, async (req, res) => {
try {
    const allDrivingTests = await DrivingTest.find().populate("Learner").populate("examiner");    
    res.status(200).json(allDrivingTests);
} catch (error) {
    res.status(500).json({ message: error.message });
}
})



module.exports = router;
