const router = require("express").Router();
const PDFDocument = require("pdfkit");
const Invoice = require("../models/invoice");
const TrainingPlan = require("../models/TrainingPlan");
const verifyToken = require("../middleware/verifyToken");
const validateObjectId = require("../middleware/validateObjectId");

// READ PDF - GET /invoices/:id/pdf
// PDF is only available after the invoice is paid
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
            return res.status(403).json({ message: "You can only download your own invoices." });
        }

        if (invoice.status !== "paid") {
            return res.status(403).json({ message: "Invoice is not paid yet." });
        }

        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoice._id}.pdf`);
        doc.pipe(res);
        doc.fontSize(20).text("DARBI Invoice");
        doc.moveDown();
        doc.fontSize(12).text(`Invoice ID: ${invoice._id}`);
        doc.text(`Date: ${invoice.date.toDateString()}`);
        doc.text(`Amount: ${invoice.amount}`);
        doc.text(`Status: ${invoice.status}`);
        doc.end();
    } catch (err) {
        res.status(500).json({ message: "Internal Server Error" });
    }
});

module.exports = router;