const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const TrainingPlan = require('../models/TrainingPlan');


router.get('/', verifyToken, async (req, res) => {
  try {
    let trainingPlans;

    if (req.user.role === 'learner') {
      trainingPlans = await TrainingPlan.find({ learner: req.user._id })
        .populate('learner')
        .populate('instructor');
    } else if (req.user.role === 'instructor') {
      trainingPlans = await TrainingPlan.find({ instructor: req.user._id })
        .populate('learner')
        .populate('instructor');
    } else {
      trainingPlans = await TrainingPlan.find()
        .populate('learner')
        .populate('instructor');
    }

    res.status(200).json(trainingPlans);
  } catch (err) {
    console.log(err);
  }
});


router.get('/:id', verifyToken, async (req, res) => {
  try {
    const trainingPlan = await TrainingPlan.findById(req.params.id)
      .populate('learner')
      .populate('instructor');

    res.status(200).json(trainingPlan);
  } catch (err) {
    console.log(err);
  }
});


router.post('/', verifyToken, async (req, res) => {
  try {
    const newTrainingPlan = await TrainingPlan.create({
      learner: req.user._id,
      instructor: req.body.instructor,
      weeklyScheduale: req.body.weeklyScheduale,
      status: 'pending',
    });

    res.status(201).json(newTrainingPlan);
  } catch (err) {
    console.log(err);
  }
});


router.put('/:id', verifyToken, async (req, res) => {
  try {
    const trainingPlan = await TrainingPlan.findById(req.params.id);

    if (
      trainingPlan.learner == req.user._id ||
      trainingPlan.instructor == req.user._id ||
      req.user.role === 'admin'
    ) {
      const updatedTrainingPlan = await TrainingPlan.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );

      return res.status(200).json(updatedTrainingPlan);
    } else {
      return res.status(403).json({ message: 'You cannot edit this training plan' });
    }
  } catch (err) {
    console.log(err);
  }
});

module.exports = router;
