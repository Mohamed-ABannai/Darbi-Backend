const express = require('express');
const router = express.Router();
const Lesson = require('../models/lesson');
const verifyToken = require('../middleware/verifyToken');
const validateObjectId = require('../middleware/validateObjectId');

router.use(verifyToken);

router.get('/', async (req, res) => {
    try {
        const lessons = await Lesson.find();
        res.json(lessons);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/:id', validateObjectId, async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
        res.json(lesson);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/', async (req, res) => {
    const lesson = new Lesson(req.body);
    try {
        const newLesson = await lesson.save();
        res.status(201).json(newLesson);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/:id', validateObjectId, async (req, res) => {
    try {
        const updatedLesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedLesson) return res.status(404).json({ message: 'Lesson not found' });
        res.json(updatedLesson);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete('/:id', validateObjectId, async (req, res) => {
    try {
        const deletedLesson = await Lesson.findByIdAndDelete(req.params.id);
        if (!deletedLesson) return res.status(404).json({ message: 'Lesson not found' });
        res.json({ message: 'Lesson deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;