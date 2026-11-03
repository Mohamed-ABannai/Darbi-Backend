const router= require('express').Router()
const User=require('../models/User')
const verifyToken=require('../middleware/verifyToken')

router.get('/',verifyToken,async(req,res)=>{
    try {

        const finduser = await User.findById(req.User)
        
        if(!finduser){
            res.status(404).json({message:'user not find please register or sign in'})
        }
        else if(finduser.role=='admin'){
          const findAllInstructor = await User.find({role:'instructor'})
          res.status(200).json(findAllInstructor)
        }
        else if (finduser.role=='learner'){
            const findAllInstructorApproved = await User.find({role:'instructor',isActive:true,isApproved:true})
          res.status(200).json(findAllInstructorApproved)
        }
        

        
    } catch (error) {
        console.log(error)
    }
})






module.exports=router