const express = require("express");
const router = express.Router();

const {
    register,
    login,
    getProfile
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");
const { loginLimiter, registrationLimiter } = require("../middleware/authRateLimiters");

router.post("/register", registrationLimiter, register);
router.post("/login", loginLimiter, login);
router.get("/me", protect, getProfile);

module.exports = router;
