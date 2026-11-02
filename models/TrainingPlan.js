const mongoose = require('mongoose')

const traningPlanSchema= new mongoose.Schema({

    learner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    instructor:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    weeklyScheduale:{
        type:Date
    },
    status:{
        type:String,
        enum:["pending","active","rejected","transferred","completed"]
    },
    reason:{
        type:String,
        minLength:20,
        maxLength:140
    }

},{timestamps:true})

const TrainingPlan= mongoose.model('TrainingPlan',traningPlanSchema)

module.exports=TrainingPlan