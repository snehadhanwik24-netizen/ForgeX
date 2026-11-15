require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const repositoryRoutes = require("./routes/repositoryRoutes");
const repositoryFileRoutes = require("./routes/repositoryFileRoutes");
const versionControlRoutes = require("./routes/versionControlRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());

app.use(cors({
    origin: "http://localhost:5173"
}));

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        application: "ForgeX",
        message: "Welcome to ForgeX API!",
        status: "Running successfully"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "healthy",
        database: "connected",
        application: "ForgeX"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/repositories", repositoryRoutes);
app.use("/api/repository-files", repositoryFileRoutes);
app.use("/api/version-control", versionControlRoutes);

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`ForgeX server running at http://localhost:${PORT}`);
            console.log("MongoDB connected successfully");
        });

    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();



