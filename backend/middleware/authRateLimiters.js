const rateLimit = require("express-rate-limit");

const createAuthLimiter = (limit, message) => rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message
    }
});

const loginLimiter = createAuthLimiter(
    10,
    "Too many login attempts. Please try again after 15 minutes."
);

const registrationLimiter = createAuthLimiter(
    5,
    "Too many registration attempts. Please try again after 15 minutes."
);

module.exports = {
    loginLimiter,
    registrationLimiter
};
