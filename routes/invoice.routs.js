const router = require("express").Router();
const PDFDocument = require("pdfkit");
const Invoice = require("../models/invoice");
const Payment = require("../models/Payment");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");

router.get("/:id/pdf", verifyToken, validateObjectId, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const payment = await Payment.findById(invoice.payment).populate({
      path: "lesson",
      populate: { path: "TrainingPlan" }
    });

    if (!payment || !payment.lesson || !payment.lesson.TrainingPlan) {
      return res.status(404).json({ message: "Payment not found." });
    }

    const plan = payment.lesson.TrainingPlan;

    if (
      plan.learner != req.user._id &&
      plan.instructor != req.user._id &&
      req.user.role != "admin" &&
      req.user.role != "superAdmin"
    ) {
      return res.status(403).json({ message: "Access denied." });
    }

    if (payment.status != "completed") {
      return res.status(403).json({ message: "Payment is not completed." });
    }

    const doc = new PDFDocument();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${invoice._id}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(20).text("DARBI Invoice");
    doc.moveDown();

    doc.fontSize(12).text(`Invoice ID: ${invoice._id}`);
    doc.text(`Date: ${invoice.date.toDateString()}`);
    doc.text(`Amount: ${invoice.amount} BHD`);
    doc.text(`Payment method: ${payment.method}`);
    doc.text(`Payment status: ${payment.status}`);

    doc.end();

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;