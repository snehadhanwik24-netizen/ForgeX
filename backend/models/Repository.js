const mongoose = require("mongoose");

const repositorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },

    description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ""
    },

    visibility: {
        type: String,
        enum: ["public", "private"],
        default: "private"
    },

    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    defaultBranch: {
        type: String,
        default: "main"
    },

    slug: {
        type: String,
        required: true
    }

}, { timestamps: true });

repositorySchema.index(
    { owner: 1, slug: 1 },
    { unique: true }
);

module.exports = mongoose.model("Repository", repositorySchema);
