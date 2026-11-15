const mongoose = require("mongoose");

const validateObjectId = (label) => (req, res, next, value) => {
    if (!mongoose.isObjectIdOrHexString(value)) {
        return res.status(400).json({
            message: `Invalid ${label}`
        });
    }

    next();
};

module.exports = validateObjectId;
