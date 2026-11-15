const mongoose = require("mongoose");

const repositoryFileSchema = new mongoose.Schema({
    repository: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Repository",
        required: true
    },

    path: {
        type: String,
        required: true,
        trim: true
    },

    name: {
        type: String,
        required: true,
        trim: true
    },

    type: {
        type: String,
        enum: ["file", "folder"],
        default: "file"
    },

    content: {
        type: String,
        default: ""
    },

    size: {
        type: Number,
        default: 0
    },

    versions: [{
        versionNumber: {
            type: Number,
            required: true
        },
        content: {
            type: String,
            default: ""
        },
        size: {
            type: Number,
            default: 0
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

repositoryFileSchema.index(
    { repository: 1, path: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "RepositoryFile",
    repositoryFileSchema
);

