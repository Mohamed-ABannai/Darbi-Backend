const mongoose = require("mongoose");

async function connectToDB() {
  const connection = await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to database: ${connection.connection.name}`);
}

module.exports = connectToDB
