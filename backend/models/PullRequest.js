const mongoose = require("mongoose");

const pullRequestSchema = new mongoose.Schema(
    {
        repository: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Repository",
            required: true,
            index: true
        },

        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 150
        },

        description: {
            type: String,
            trim: true,
            maxlength: 5000,
            default: ""
        },

        sourceBranch: {
            type: String,
            required: true,
            trim: true
        },

        targetBranch: {
            type: String,
            required: true,
            trim: true
        },

        status: {
            type: String,
            enum: ["open", "closed", "merged"],
            default: "open",
            index: true
        },

        reviewers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],

        reviews: [{
            reviewer: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true
            },

            state: {
                type: String,
                enum: ["approved", "changes_requested", "commented"],
                required: true
            },

            body: {
                type: String,
                trim: true,
                maxlength: 5000,
                default: ""
            },

            submittedAt: {
                type: Date,
                default: Date.now
            }
        }],
        mergedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        mergedAt: {
            type: Date,
            default: null
        },

        closedAt: {
            type: Date,
            default: null
        },

        mergeCommitId: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

pullRequestSchema.index({
    repository: 1,
    status: 1,
    createdAt: -1
});

pullRequestSchema.index({
    repository: 1,
    sourceBranch: 1,
    targetBranch: 1,
    status: 1
});

module.exports = mongoose.model("PullRequest", pullRequestSchema);

