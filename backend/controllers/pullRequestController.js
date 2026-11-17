const PullRequest = require("../models/PullRequest");
const Repository = require("../models/Repository");
const User = require("../models/User");
const { runPythonEngine } = require("../services/pythonEngineService");

async function findOwnedRepository(repositoryId, userId) {
    return Repository.findOne({
        _id: repositoryId,
        owner: userId
    });
}

function extractBranches(result) {
    if (Array.isArray(result)) return result;

    if (Array.isArray(result?.branches)) return result.branches;
    if (Array.isArray(result?.data?.branches)) return result.data.branches;

    throw new Error("Unexpected branch list returned by the version-control engine");
}

async function getRepositoryBranches(repositoryId) {
    const result = await runPythonEngine({
        action: "list_branches",
        repository_id: repositoryId.toString()
    });

    return extractBranches(result).map(branch =>
        typeof branch === "string" ? branch : branch.name
    ).filter(Boolean);
}

// Create a pull request
exports.createPullRequest = async (req, res) => {
    try {
        const { repositoryId, title, description, sourceBranch, targetBranch } = req.body;

        if (
            !repositoryId ||
            typeof title !== "string" ||
            title.trim().length < 3 ||
            typeof sourceBranch !== "string" ||
            typeof targetBranch !== "string"
        ) {
            return res.status(400).json({
                message: "Repository, title, source branch and target branch are required"
            });
        }

        if (title.trim().length > 150) {
            return res.status(400).json({
                message: "Pull request title cannot exceed 150 characters"
            });
        }

        if (typeof description !== "undefined" &&
            (typeof description !== "string" || description.length > 5000)) {
            return res.status(400).json({
                message: "Description must be text with at most 5000 characters"
            });
        }

        const source = sourceBranch.trim();
        const target = targetBranch.trim();

        if (source === target) {
            return res.status(400).json({
                message: "Source and target branches must be different"
            });
        }

        const repository = await findOwnedRepository(
            repositoryId,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({
                message: "Repository not found"
            });
        }

        const branches = await getRepositoryBranches(repository._id);

        if (!branches.includes(source) || !branches.includes(target)) {
            return res.status(400).json({
                message: "Source or target branch does not exist",
                availableBranches: branches
            });
        }

        const existing = await PullRequest.findOne({
            repository: repository._id,
            sourceBranch: source,
            targetBranch: target,
            status: "open"
        });

        if (existing) {
            return res.status(409).json({
                message: "An open pull request already exists for these branches",
                pullRequest: existing
            });
        }

        const pullRequest = await PullRequest.create({
            repository: repository._id,
            author: req.user._id,
            title: title.trim(),
            description: description?.trim() || "",
            sourceBranch: source,
            targetBranch: target
        });

        return res.status(201).json({
            message: "Pull request created successfully",
            pullRequest
        });
    } catch (error) {
        console.error("Pull request creation failed:", error);

        return res.status(500).json({
            message: "Failed to create pull request"
        });
    }
};

// List pull requests belonging to an owned repository
exports.getPullRequests = async (req, res) => {
    try {
        const repository = await findOwnedRepository(
            req.params.repositoryId,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({
                message: "Repository not found"
            });
        }

        const filter = {
            repository: repository._id
        };

        const status = req.query.status;

        if (status) {
            if (!["open", "closed", "merged"].includes(status)) {
                return res.status(400).json({
                    message: "Invalid pull request status"
                });
            }

            filter.status = status;
        }

        const pullRequests = await PullRequest.find(filter)
            .populate("author", "name username")
            .populate("reviewers", "name username")
            .sort({ createdAt: -1 });

        return res.json({
            count: pullRequests.length,
            pullRequests
        });
    } catch (error) {
        console.error("Pull request listing failed:", error);

        return res.status(500).json({
            message: "Failed to retrieve pull requests"
        });
    }
};

// View one pull request
exports.getPullRequest = async (req, res) => {
    try {
        const pullRequest = await PullRequest.findById(req.params.id)
            .populate("author", "name username")
            .populate("reviewers", "name username")
            .populate("mergedBy", "name username");

        if (!pullRequest) {
            return res.status(404).json({
                message: "Pull request not found"
            });
        }

        const repository = await findOwnedRepository(
            pullRequest.repository,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({
                message: "Pull request not found"
            });
        }

        return res.json({ pullRequest });
    } catch (error) {
        console.error("Pull request retrieval failed:", error);

        return res.status(500).json({
            message: "Failed to retrieve pull request"
        });
    }
};

// Close an open pull request
exports.closePullRequest = async (req, res) => {
    try {
        const pullRequest = await PullRequest.findById(req.params.id);

        if (!pullRequest) {
            return res.status(404).json({
                message: "Pull request not found"
            });
        }

        const repository = await findOwnedRepository(
            pullRequest.repository,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({
                message: "Pull request not found"
            });
        }

        if (pullRequest.status !== "open") {
            return res.status(409).json({
                message: "Only open pull requests can be closed"
            });
        }

        pullRequest.status = "closed";
        pullRequest.closedAt = new Date();

        await pullRequest.save();

        return res.json({
            message: "Pull request closed successfully",
            pullRequest
        });
    } catch (error) {
        console.error("Pull request closure failed:", error);

        return res.status(500).json({
            message: "Failed to close pull request"
        });
    }
};

// Compare the source and target branches of a pull request
exports.getPullRequestComparison = async (req, res) => {
    try {
        const pullRequest = await PullRequest.findById(req.params.id);

        if (!pullRequest) {
            return res.status(404).json({
                message: "Pull request not found"
            });
        }

        const repository = await findOwnedRepository(
            pullRequest.repository,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({
                message: "Pull request not found"
            });
        }

        const comparison = await runPythonEngine({
            action: "compare_branches",
            repository_id: repository._id.toString(),
            source_branch: pullRequest.sourceBranch,
            target_branch: pullRequest.targetBranch
        });

        return res.status(200).json({
            pullRequestId: pullRequest._id,
            title: pullRequest.title,
            status: pullRequest.status,
            comparison
        });

    } catch (error) {
        console.error("Pull request comparison failed:", error);

        return res.status(400).json({
            message: "Failed to compare pull request branches",
            error: error.message
        });
    }
};

// Assign reviewers to a pull request (repository owner only)
exports.assignPullRequestReviewers = async (req, res) => {
    try {
        const { reviewerIds } = req.body;

        if (
            !Array.isArray(reviewerIds) ||
            reviewerIds.length < 1 ||
            reviewerIds.length > 10 ||
            reviewerIds.some(id => typeof id !== "string")
        ) {
            return res.status(400).json({
                message: "Provide between 1 and 10 reviewer IDs"
            });
        }

        const uniqueIds = [...new Set(reviewerIds)];

        if (uniqueIds.length !== reviewerIds.length) {
            return res.status(400).json({
                message: "Duplicate reviewers are not allowed"
            });
        }

        const pullRequest = await PullRequest.findById(req.params.id);

        if (!pullRequest) {
            return res.status(404).json({
                message: "Pull request not found"
            });
        }

        const repository = await findOwnedRepository(
            pullRequest.repository,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({
                message: "Pull request not found"
            });
        }

        if (pullRequest.status !== "open") {
            return res.status(409).json({
                message: "Reviewers can only be assigned to open pull requests"
            });
        }

        if (uniqueIds.some(id => id === req.user._id.toString())) {
            return res.status(400).json({
                message: "Repository owners cannot assign themselves as reviewers"
            });
        }

        const users = await User.find({
            _id: { $in: uniqueIds }
        }).select("_id");

        if (users.length !== uniqueIds.length) {
            return res.status(400).json({
                message: "One or more reviewer accounts do not exist"
            });
        }

        pullRequest.reviewers = users.map(user => user._id);
        await pullRequest.save();

        await pullRequest.populate("reviewers", "name username");

        return res.json({
            message: "Pull Request reviewers assigned successfully",
            reviewers: pullRequest.reviewers
        });

    } catch (error) {
        console.error("Reviewer assignment failed:", error);

        return res.status(400).json({
            message: "Failed to assign reviewers",
            error: error.message
        });
    }
};


// Submit a Pull Request review (assigned reviewers only)
exports.submitPullRequestReview = async (req, res) => {
    try {
        const { state, body = "" } = req.body;

        const allowedStates = [
            "approved",
            "changes_requested",
            "commented"
        ];

        if (!allowedStates.includes(state)) {
            return res.status(400).json({
                message: "Review state must be approved, changes_requested or commented"
            });
        }

        if (typeof body !== "string" || body.length > 5000) {
            return res.status(400).json({
                message: "Review comment must be text with at most 5000 characters"
            });
        }

        if (state === "changes_requested" && !body.trim()) {
            return res.status(400).json({
                message: "A comment is required when requesting changes"
            });
        }

        const pullRequest = await PullRequest.findById(req.params.id);

        if (!pullRequest) {
            return res.status(404).json({
                message: "Pull request not found"
            });
        }

        const assignedReviewer = pullRequest.reviewers.some(
            reviewer => reviewer.toString() === req.user._id.toString()
        );

        if (!assignedReviewer) {
            return res.status(403).json({
                message: "Only assigned reviewers can submit reviews"
            });
        }

        if (pullRequest.status !== "open") {
            return res.status(409).json({
                message: "Reviews can only be submitted for open pull requests"
            });
        }

        const review = {
            reviewer: req.user._id,
            state,
            body: body.trim(),
            submittedAt: new Date()
        };

        pullRequest.reviews.push(review);
        await pullRequest.save();

        return res.status(201).json({
            message: "Pull Request review submitted successfully",
            review: pullRequest.reviews[pullRequest.reviews.length - 1]
        });

    } catch (error) {
        console.error("Review submission failed:", error);

        return res.status(400).json({
            message: "Failed to submit Pull Request review",
            error: error.message
        });
    }
};
