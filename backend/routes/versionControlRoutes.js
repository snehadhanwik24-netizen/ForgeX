const express = require("express");
const { revertCommit, cherryPickCommit, createRepositoryTag, getRepositoryTags, createRepositoryRelease, getRepositoryReleases } = require("../controllers/versionControlController");
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
    stageDeletion,
    mergeBranch,
    getConflictDetails,
    resolveConflicts
} = require("../controllers/versionControlController");

// All version-control routes require authentication
router.use(protect);
router.post("/:repositoryId/revert", revertCommit);
router.post("/:repositoryId/cherry-pick", cherryPickCommit);
router.get("/:repositoryId/tags", getRepositoryTags);
router.post("/:repositoryId/tags", createRepositoryTag);
router.get("/:repositoryId/releases", getRepositoryReleases);
router.post("/:repositoryId/releases", createRepositoryRelease);

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
router.post("/:repositoryId/merge", mergeBranch);
router.post("/:repositoryId/conflicts", getConflictDetails);
router.post("/:repositoryId/resolve-conflicts", resolveConflicts);

module.exports = router;
