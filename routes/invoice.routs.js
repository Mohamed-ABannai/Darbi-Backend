const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const verifyToken = require('../middleware/verifyToken');
const validateObjectId = require('../middleware/validateObjectId');

router.use(verifyToken);

const handleError = (err, res) => {
    console.error(err);
    if (err.name === 'ValidationError' || err.name === 'CastError') {
        return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: 'Internal Server Error' });
};

router.get('/', async (req, res) => {
    try {
        const invoices = await Invoice.find().populate('TrainingPlan').sort({ date: -1 });
        res.status(200).json(invoices);
    } catch (err) {
        handleError(err, res);
    }
});

router.get('/:id', validateObjectId, async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).populate('TrainingPlan');
        if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
        res.status(200).json(invoice);
    } catch (err) {
        handleError(err, res);
    }
});

router.post('/', async (req, res) => {
    try {
        const { TrainingPlan, date, amount, status } = req.body;
        const invoice = await Invoice.create({ TrainingPlan, date, amount, status });
        res.status(201).json(invoice);
    } catch (err) {
        handleError(err, res);
    }
});

router.put('/:id', validateObjectId, async (req, res) => {
    try {
        const { TrainingPlan, date, amount, status } = req.body;
        const invoice = await Invoice.findByIdAndUpdate(
            req.params.id,
            { TrainingPlan, date, amount, status },
            { new: true, runValidators: true }
        );
        if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
        res.status(200).json(invoice);
    } catch (err) {
        handleError(err, res);
    }
});

router.delete('/:id', validateObjectId, async (req, res) => {
    try {
        const invoice = await Invoice.findByIdAndDelete(req.params.id);
        if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
        res.status(200).json({ message: 'Invoice deleted' });
    } catch (err) {
        handleError(err, res);
    }
});

module.exports = router;
