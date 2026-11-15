const router = require("express").Router();
const PDFDocument = require("pdfkit");
const createInvoicePdf = require("../pdf/createInvoicePdf");
const Invoice = require("../models/invoice");
const Payment = require("../models/Payment");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");

router.get("/:id/pdf", verifyToken, validateObjectId, async (req, res) => {
  try {
    let invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      invoice = await Invoice.findOne({ payment: req.params.id });
    }
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const payment = await Payment.findById(invoice.payment).populate({
      path: "lesson",
      populate: {
        path: "TrainingPlan",
        populate: [
          { path: "learner", select: "username" },
          { path: "instructor", select: "username" }
        ]
      }
    });

    if (!payment || !payment.lesson || !payment.lesson.TrainingPlan) {
      return res.status(404).json({ message: "Payment not found." });
    }

    const plan = payment.lesson.TrainingPlan;

    const learnerId = plan.learner?._id || plan.learner;
    const instructorId = plan.instructor?._id || plan.instructor;

    if (
      String(learnerId) !== String(req.user._id) &&
      String(instructorId) !== String(req.user._id) &&
      req.user.role != "admin" &&
      req.user.role != "superAdmin"
    ) {
      return res.status(403).json({ message: "Access denied." });
    }

    if (payment.status != "completed") {
      return res.status(403).json({ message: "Payment is not completed." });
    }

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 48, right: 48, bottom: 58, left: 48 },
      bufferPages: true,
      info: {
        Title: `DARBI invoice ${invoice._id}`,
        Author: "DARBI"
      }
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${invoice._id}.pdf`
    );

    doc.pipe(res);
    createInvoicePdf(doc, {
      invoice,
      payment,
      lesson: payment.lesson,
      learner: plan.learner,
      instructor: plan.instructor
    });
    doc.end();

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
