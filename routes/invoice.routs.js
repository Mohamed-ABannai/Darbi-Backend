const router = require("express").Router();
const PDFDocument = require("pdfkit");
const Invoice = require("../models/invoice");
const TrainingPlan = require("../models/TrainingPlan");
const Lesson = require("../models/lesson");
const Payment = require("../models/Payment");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");

// READ PDF - GET /invoices/:id/pdf
// PDF WILL BE VALID WHEN PPAYMENT IS DONE! 
router.get("/:id/pdf", verifyToken, validateObjectId, async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found." });
        }

        const plan = await TrainingPlan.findById(invoice.TrainingPlan);
        const isMember =
            plan && (String(plan.learner) === req.user._id || String(plan.instructor) === req.user._id);
        if (!isMember && req.user.role !== "admin") {
            return res.status(403).json({ message: "You are not authorized to download this Data!." });
            console.log(`Unauthorized access attempt by user ${req.user._id}`);

        }

        const lessons = await Lesson.find({ TrainingPlan: invoice.TrainingPlan }).select("_id");
        const confirmedPayment = await Payment.findOne({
            lesson: { $in: lessons.map((lesson) => lesson._id) },
            status: "completed",
        });
        if (!confirmedPayment) {
            return res.status(403).json({ message: "Payment Failed!please try again." });
        }

        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoice._id}.pdf`);
        doc.pipe(res);
        doc.text("DARBI Invoice");
        doc.text(`Invoice ID: ${invoice._id}`);
        doc.text(`Date: ${invoice.date.toDateString()}`);
        doc.text(`Amount: ${invoice.amount}`);
        doc.text(`Payment method: ${confirmedPayment.method}`);
        doc.end();
    } catch (err) {
        res.status(500).json({ message: "Internal Server Error" });
    }
});

module.exports = router;