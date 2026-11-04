const router = require("express").Router();
const verifyToken = require("../middleware/verifyToken");
const Payment = require("../models/Payment");
const User = require("../models/User");

router.get("/", verifyToken, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "learner") {
      filter = { Learner: req.user._id };
    } else if (req.user.role === "instructor") {
      filter = { instructor: req.user._id };
    } else if (req.user.role === "admin") {
      filter = {}; // Admin can see all payments
    }

    const allPayments = await Payment.find(filter)
      .populate("Learner")
      .populate("instructor");
    return res.status(200).json(allPayments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", verifyToken, async (req, res) => {
try {
    
} catch (error) {
    
}

})

module.exports = router;
