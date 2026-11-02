const mongoose= require('mongoose')

const reviewSchema= new mongoose.Schema({

TrainingPlan:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'TrainingPlan',
},
rating:{
    type:Number
},
patience:{
    type:Number,
    
},
raiseVoice:{
    type:Boolean
},
comment:{
    type:String,
    minLength:10,
    maxLength:150
}

},{timestamps:true})

const Review= mongoose.model('Review',reviewSchema)

module.exports=Review