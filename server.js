require("dotenv").config();

const connectToDB = require("./config/db");
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const { standardLimiter } = require("./middleware/rateLimiters");
const authRoutes = require("./routes/auth.routes");
const trainingPlanRoutes = require("./routes/trainingPlans.routes");
const lessonRoutes = require("./routes/lesson.Route");
const invoiceRoutes = require("./routes/invoice.routs");
const userRoutes = require("./routes/user.routes");
const drivingTestRoutes = require("./routes/DrivingTest.routes");
const reviewRoutes = require("./routes/Review.routes");
const paymentRoutes = require("./routes/Payment.routes");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));
app.use(standardLimiter);
app.use(express.json());
app.use(morgan("dev"));

app.use("/auth", authRoutes);
app.use("/training-plans", trainingPlanRoutes);
app.use("/users", userRoutes);
app.use("/payments", paymentRoutes);
app.use("/driving-tests", drivingTestRoutes);
app.use("/lessons", lessonRoutes);
app.use("/invoices", invoiceRoutes);
app.use("/reviews", reviewRoutes);

async function startServer() {
    const PORT = process.env.PORT || 3000;
    await connectToDB();

    app.listen(PORT, () => {
        console.log(`App is running on port ${PORT}`);
    });
}
startServer().catch((error) => {
    console.error("Failed to start the server", error);
    process.exitCode = 1;
});
