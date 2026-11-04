const mongoose = require('mongoose')
function validateObjectId(req,res,next){
if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Invalid ID format or resource not found " });
    }
next()
}

module.exports = validateObjectId