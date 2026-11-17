require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const repositoryRoutes = require("./routes/repositoryRoutes");
const repositoryFileRoutes = require("./routes/repositoryFileRoutes");
const versionControlRoutes = require("./routes/versionControlRoutes");
const pullRequestRoutes = require("./routes/pullRequestRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    throw new Error("JWT_SECRET must be configured before starting ForgeX.");
}

app.use(helmet());

const allowedOrigins = (
    process.env.CORS_ORIGINS ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173"
).split(",").map(origin => origin.trim()).filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(null, false);
    }
}));

app.use(express.json({ limit: "1mb" }));

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
app.use("/api/pull-requests", pullRequestRoutes);

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

