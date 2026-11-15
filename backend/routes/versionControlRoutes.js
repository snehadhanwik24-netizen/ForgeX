const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
    stageFile,
    createCommit,
    getCommitHistory,
    getDashboardStats,
    switchBranch,
    createBranch,
    getBranches,
    getFileDiff,
    getWorkingTreeStatus,
    getStagingStatus,
    unstageFile,
    unstageDeletion,
    stageDeletion
} = require("../controllers/versionControlController");

// All version-control routes require authentication
router.use(protect);

// Dashboard statistics
router.get("/dashboard/stats", getDashboardStats);

// Stage a repository file
router.post("/:repositoryId/stage/:fileId", stageFile);

// Staging area
router.get("/:repositoryId/staging", getStagingStatus);
router.delete("/:repositoryId/staging/file", unstageFile);
router.delete("/:repositoryId/staging/deletion", unstageDeletion);
router.post("/:repositoryId/stage-deletion", stageDeletion);
// Create a commit
router.post("/:repositoryId/commit", createCommit);

// Get commit history
router.get("/:repositoryId/history", getCommitHistory);
router.get("/:repositoryId/branches", getBranches);
router.get("/:repositoryId/diff", getFileDiff);
router.get("/:repositoryId/status", getWorkingTreeStatus);
router.post("/:repositoryId/branches", createBranch);
router.post("/:repositoryId/branches/switch", switchBranch);

module.exports = router;





