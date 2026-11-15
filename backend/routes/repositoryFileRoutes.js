const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const validateObjectId = require("../middleware/validateObjectId");

const {
    createFile,
    getFiles,
    getFile,
    updateFile,
    deleteFile,
    getFileVersions,
    restoreFileVersion
} = require("../controllers/repositoryFileController");

router.use(protect);

router.param("repositoryId", validateObjectId("repository ID"));
router.param("fileId", validateObjectId("file ID"));

// Create a file or folder
router.post("/:repositoryId/files", createFile);

// Get all repository files
router.get("/:repositoryId/files", getFiles);

// Get one file
router.get("/:repositoryId/files/:fileId", getFile);

// Update file contents
router.put("/:repositoryId/files/:fileId", updateFile);

// Delete a file or folder
router.delete("/:repositoryId/files/:fileId", deleteFile);

// File version history
router.get("/:repositoryId/files/:fileId/versions", getFileVersions);
router.post("/:repositoryId/files/:fileId/versions/:versionNumber/restore", restoreFileVersion);

module.exports = router;
