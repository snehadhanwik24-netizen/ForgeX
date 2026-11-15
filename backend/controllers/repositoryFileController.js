const Repository = require("../models/Repository");
const RepositoryFile = require("../models/RepositoryFile");

const findOwnedRepository = async (repositoryId, userId) => {
    return Repository.findOne({
        _id: repositoryId,
        owner: userId
    });
};

const normalizePath = (value) => {
    if (typeof value !== "string") return null;

    const normalized = value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

    if (!normalized) return null;

    const parts = normalized.split("/");

    if (parts.some(part =>
        !part || part === "." || part === ".."
    )) {
        return null;
    }

    return normalized;
};

// Create a file or folder
const createFile = async (req, res) => {
    try {
        const { path, name, type, content } = req.body;

        if (!path || !name || typeof name !== "string") {
            return res.status(400).json({
                message: "File path and name are required"
            });
        }

        const fileType = type || "file";

        if (!["file", "folder"].includes(fileType)) {
            return res.status(400).json({
                message: "Invalid file type"
            });
        }

        const normalizedPath = normalizePath(path);

        if (!normalizedPath) {
            return res.status(400).json({
                message: "Invalid file path"
            });
        }

        const cleanName = name.trim();

        if (!cleanName || cleanName.includes("/") || cleanName.includes("\\")) {
            return res.status(400).json({
                message: "Invalid file name"
            });
        }

        if (fileType === "file" && content !== undefined && typeof content !== "string") {
            return res.status(400).json({
                message: "File content must be a string"
            });
        }

        const repository = await findOwnedRepository(
            req.params.repositoryId,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({
                message: "Repository not found"
            });
        }

        if (normalizedPath !== cleanName &&
            !normalizedPath.endsWith("/" + cleanName)) {
            return res.status(400).json({
                message: "File name must match the final part of its path"
            });
        }

        // Verify that the parent folder exists
        const pathParts = normalizedPath.split("/");

        if (pathParts.length > 1) {
            const parentPath = pathParts.slice(0, -1).join("/");

            const parentFolder = await RepositoryFile.findOne({
                repository: repository._id,
                path: parentPath,
                type: "folder"
            });

            if (!parentFolder) {
                return res.status(400).json({
                    message: "Parent folder does not exist"
                });
            }
        }

        const existingFile = await RepositoryFile.findOne({
            repository: repository._id,
            path: normalizedPath
        });

        if (existingFile) {
            return res.status(409).json({
                message: "A file or folder already exists at this path"
            });
        }

        const fileContent = fileType === "folder" ? "" : (content || "");

        const file = await RepositoryFile.create({
            repository: repository._id,
            path: normalizedPath,
            name: cleanName,
            type: fileType,
            content: fileContent,
            size: Buffer.byteLength(fileContent, "utf8")
        });

        res.status(201).json({
            message: "File created successfully",
            file
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "A file or folder already exists at this path"
            });
        }

        res.status(500).json({
            message: error.message
        });
    }
};

// Get files and folders directly inside a requested folder
const getFiles = async (req, res) => {
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

        const requestedPath = req.query.path || "";

        if (requestedPath) {
            const normalizedPath = normalizePath(requestedPath);

            if (!normalizedPath) {
                return res.status(400).json({
                    message: "Invalid folder path"
                });
            }

            const folder = await RepositoryFile.findOne({
                repository: repository._id,
                path: normalizedPath,
                type: "folder"
            });

            if (!folder) {
                return res.status(404).json({
                    message: "Folder not found"
                });
            }
        }

        const parentPath = requestedPath
            ? requestedPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
            : "";

        const prefix = parentPath ? parentPath + "/" : "";

        const allFiles = await RepositoryFile.find({
            repository: repository._id
        }).sort({ path: 1 });

        const files = allFiles.filter(file => {
            if (!file.path.startsWith(prefix)) return false;

            const remainingPath = file.path.slice(prefix.length);

            return remainingPath.length > 0 && !remainingPath.includes("/");
        });

        res.status(200).json({
            count: files.length,
            currentPath: parentPath,
            files
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

// Get one file
const getFile = async (req, res) => {
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

        const file = await RepositoryFile.findOne({
            _id: req.params.fileId,
            repository: repository._id
        });

        if (!file) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        res.status(200).json({ file });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

// Update file content
const updateFile = async (req, res) => {
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

        const file = await RepositoryFile.findOne({
            _id: req.params.fileId,
            repository: repository._id
        });

        if (!file) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        if (file.type !== "file") {
            return res.status(400).json({
                message: "Only files can be edited"
            });
        }

        if (typeof req.body.content !== "string") {
            return res.status(400).json({
                message: "File content must be a string"
            });
        }

        // Preserve the previous version before updating
        if (file.content !== req.body.content) {
            if (!file.versions) {
                file.versions = [];
            }

            file.versions.push({
                versionNumber: file.versions.length + 1,
                content: file.content,
                size: Buffer.byteLength(file.content, "utf8"),
                author: req.user._id,
                createdAt: new Date()
            });
        }

        // Update the current file content
        file.content = req.body.content;
        file.size = Buffer.byteLength(file.content, "utf8");

        await file.save();

        res.status(200).json({
            message: "File updated successfully",
            file
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

// Delete a file or an empty folder
const deleteFile = async (req, res) => {
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

        const file = await RepositoryFile.findOne({
            _id: req.params.fileId,
            repository: repository._id
        });

        if (!file) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        if (file.type === "folder") {
            const prefix = file.path + "/";

            const children = await RepositoryFile.find({
                repository: repository._id,
                path: { $regex: "^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }
            });

            if (children.length > 0) {
                return res.status(400).json({
                    message: "Folder is not empty. Delete its contents first."
                });
            }
        }

        await file.deleteOne();

        res.status(200).json({
            message: "File deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

module.exports = {
    createFile,
    getFiles,
    getFile,
    updateFile,
    deleteFile
};


// Get previous versions of a file
const getFileVersions = async (req, res) => {
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

        const file = await RepositoryFile.findOne({
            _id: req.params.fileId,
            repository: repository._id,
            type: "file"
        });

        if (!file) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        res.status(200).json({
            currentContent: file.content,
            currentSize: file.size,
            versions: file.versions || []
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

// Restore a previous version
const restoreFileVersion = async (req, res) => {
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

        const file = await RepositoryFile.findOne({
            _id: req.params.fileId,
            repository: repository._id,
            type: "file"
        });

        if (!file) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        const versionNumber = Number(req.params.versionNumber);

        if (!Number.isInteger(versionNumber) || versionNumber < 1) {
            return res.status(400).json({
                message: "Invalid version number"
            });
        }

        const previousVersion = file.versions.find(
            version => version.versionNumber === versionNumber
        );

        if (!previousVersion) {
            return res.status(404).json({
                message: "Version not found"
            });
        }

        if (file.content !== previousVersion.content) {
            file.versions.push({
                versionNumber: file.versions.length + 1,
                content: file.content,
                size: Buffer.byteLength(file.content, "utf8"),
                author: req.user._id,
                createdAt: new Date()
            });
        }

        file.content = previousVersion.content;
        file.size = Buffer.byteLength(file.content, "utf8");

        await file.save();

        res.status(200).json({
            message: "File version restored successfully",
            file
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

module.exports.getFileVersions = getFileVersions;
module.exports.restoreFileVersion = restoreFileVersion;

