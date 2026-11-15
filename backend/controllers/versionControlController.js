const Repository = require("../models/Repository");
const RepositoryFile = require("../models/RepositoryFile");
const { runPythonEngine } = require("../services/pythonEngineService");

// Verify repository ownership
const findOwnedRepository = async (repositoryId, userId) => {
    return Repository.findOne({
        _id: repositoryId,
        owner: userId
    });
};

// Stage a repository file
exports.stageFile = async (req, res) => {
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

        const result = await runPythonEngine({
            action: "stage",
            repository_id: repository._id.toString(),
            file_path: file.path,
            content: file.content
        });

        res.status(200).json({
            message: "File staged successfully",
            data: result
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to stage file",
            error: error.message
        });
    }
};

// Create a commit
exports.createCommit = async (req, res) => {
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

        const { message } = req.body;

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                message: "Commit message is required"
            });
        }

        const result = await runPythonEngine({
            action: "commit",
            repository_id: repository._id.toString(),
            message: message.trim()
        });

        res.status(201).json({
            message: "Commit created successfully",
            commit: result
        });

    } catch (error) {
        res.status(400).json({
            message: "Failed to create commit",
            error: error.message
        });
    }
};

// Get commit history
exports.getCommitHistory = async (req, res) => {
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

        const result = await runPythonEngine({
            action: "history",
            repository_id: repository._id.toString()
        });

        res.status(200).json({
            count: result.length,
            commits: result
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to retrieve commit history",
            error: error.message
        });
    }
};

// Get dashboard statistics across all repositories owned by the user
exports.getDashboardStats = async (req, res) => {
    try {
        const repositories = await Repository.find({
            owner: req.user._id
        });

        const repositoryStats = await Promise.all(
            repositories.map(async (repository) => {
                const commits = await runPythonEngine({
                    action: "history",
                    repository_id: repository._id.toString()
                });

                return {
                    repositoryId: repository._id,
                    repositoryName: repository.name,
                    commitCount: commits.length
                };
            })
        );

        const totalCommits = repositoryStats.reduce(
            (total, repository) => total + repository.commitCount,
            0
        );

        res.status(200).json({
            repositoryCount: repositories.length,
            totalCommits,
            repositories: repositoryStats
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch dashboard statistics",
            error: error.message
        });
    }
};

// Switch branches safely and restore the destination snapshot.
exports.switchBranch = async (req, res) => {
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

        const branchName = req.body.branchName;

        if (typeof branchName !== "string" || !branchName.trim()) {
            return res.status(400).json({
                message: "Branch name is required"
            });
        }

        // Read current committed snapshot.
        const currentSnapshot = await runPythonEngine({
            action: "get_snapshot",
            repository_id: repository._id.toString()
        });

        // Compare MongoDB working files with committed files.
        const currentDocuments = await RepositoryFile.find({
            repository: repository._id
        }).lean();

        const workingFiles = {};

        for (const file of currentDocuments) {
            if (file.type === "file") {
                workingFiles[file.path] = file.content || "";
            }
        }

        const committedFiles = currentSnapshot.files || {};

        const allPaths = new Set([
            ...Object.keys(workingFiles),
            ...Object.keys(committedFiles)
        ]);

        const dirtyPaths = [];

        for (const filePath of allPaths) {
            if (
                !Object.prototype.hasOwnProperty.call(workingFiles, filePath) ||
                !Object.prototype.hasOwnProperty.call(committedFiles, filePath) ||
                workingFiles[filePath] !== committedFiles[filePath]
            ) {
                dirtyPaths.push(filePath);
            }
        }

        if (dirtyPaths.length > 0) {
            return res.status(409).json({
                message: "Cannot switch branches: commit or discard your working changes first.",
                dirtyFiles: dirtyPaths
            });
        }

        // Switch branch through the Python version-control engine.
        const result = await runPythonEngine({
            action: "switch_branch",
            repository_id: repository._id.toString(),
            branch_name: branchName.trim()
        });

        const destinationFiles = result.files || {};
        const desiredDocuments = new Map();

        // Reconstruct parent folders from committed file paths.
        for (const [filePath, content] of Object.entries(destinationFiles)) {
            const parts = filePath.split("/");

            for (let i = 1; i < parts.length; i++) {
                const folderPath = parts.slice(0, i).join("/");

                desiredDocuments.set(folderPath, {
                    repository: repository._id,
                    path: folderPath,
                    name: parts[i - 1],
                    type: "folder",
                    content: "",
                    size: 0
                });
            }

            desiredDocuments.set(filePath, {
                repository: repository._id,
                path: filePath,
                name: parts[parts.length - 1],
                type: "file",
                content,
                size: Buffer.byteLength(content, "utf8")
            });
        }

        const desiredPaths = [...desiredDocuments.keys()];

        // Upsert destination files and folders before removing stale paths.
        if (desiredDocuments.size > 0) {
            await RepositoryFile.bulkWrite(
                [...desiredDocuments.values()].map((document) => ({
                    updateOne: {
                        filter: {
                            repository: repository._id,
                            path: document.path
                        },
                        update: {
                            $set: document
                        },
                        upsert: true
                    }
                }))
            );
        }

        // Remove files and folders that do not exist in the destination.
        await RepositoryFile.deleteMany({
            repository: repository._id,
            path: { $nin: desiredPaths }
        });

        return res.status(200).json({
            message: "Branch switched successfully",
            branch: result.branch,
            fileCount: result.file_count,
            files: destinationFiles
        });

    } catch (error) {
        return res.status(400).json({
            message: "Failed to switch branch",
            error: error.message
        });
    }
};

// Create a new branch
exports.createBranch = async (req, res) => {
    try {
        const repository = await findOwnedRepository(
            req.params.repositoryId,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({ message: "Repository not found" });
        }

        const { branchName } = req.body;

        if (typeof branchName !== "string" || !branchName.trim()) {
            return res.status(400).json({ message: "Branch name is required" });
        }

        const result = await runPythonEngine({
            action: "create_branch",
            repository_id: repository._id.toString(),
            branch_name: branchName.trim()
        });

        return res.status(201).json({
            message: "Branch created successfully",
            branch: result
        });
    } catch (error) {
        return res.status(400).json({
            message: "Failed to create branch",
            error: error.message
        });
    }
};

// List repository branches
exports.getBranches = async (req, res) => {
    try {
        const repository = await findOwnedRepository(
            req.params.repositoryId,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({ message: "Repository not found" });
        }

        const result = await runPythonEngine({
            action: "list_branches",
            repository_id: repository._id.toString()
        });

        return res.status(200).json({
            branches: result
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to retrieve branches",
            error: error.message
        });
    }
};

// Compare a file between two commits
exports.getFileDiff = async (req, res) => {
    try {
        const repository = await findOwnedRepository(
            req.params.repositoryId,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({ message: "Repository not found" });
        }

        const { oldCommitId, newCommitId, filePath } = req.query;

        if (!oldCommitId || !newCommitId || !filePath) {
            return res.status(400).json({
                message: "Both commit IDs and a file path are required"
            });
        }

        const result = await runPythonEngine({
            action: "diff",
            repository_id: repository._id.toString(),
            old_commit_id: oldCommitId,
            new_commit_id: newCommitId,
            file_path: filePath
        });

        return res.status(200).json(result);
    } catch (error) {
        return res.status(400).json({
            message: "Failed to compare file versions",
            error: error.message
        });
    }
};

// Get working tree status compared with the current branch snapshot
exports.getWorkingTreeStatus = async (req, res) => {
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

        const snapshot = await runPythonEngine({
            action: "get_snapshot",
            repository_id: repository._id.toString()
        });

        const documents = await RepositoryFile.find({
            repository: repository._id,
            type: "file"
        }).lean();

        const committed = snapshot.files || {};
        const working = new Map(
            documents.map(file => [file.path, file.content || ""])
        );

        const added = [];
        const modified = [];
        const deleted = [];

        for (const [filePath, content] of working.entries()) {
            if (!Object.prototype.hasOwnProperty.call(committed, filePath)) {
                added.push({ path: filePath });
            } else if (committed[filePath] !== content) {
                modified.push({ path: filePath });
            }
        }

        for (const filePath of Object.keys(committed)) {
            if (!working.has(filePath)) {
                deleted.push({ path: filePath });
            }
        }

        return res.status(200).json({
            branch: snapshot.branch,
            clean: added.length === 0 &&
                modified.length === 0 &&
                deleted.length === 0,
            summary: {
                added: added.length,
                modified: modified.length,
                deleted: deleted.length
            },
            changes: { added, modified, deleted }
        });

    } catch (error) {
        return res.status(500).json({
            message: "Failed to inspect working tree",
            error: error.message
        });
    }
};

// Get staging area contents
exports.getStagingStatus = async (req, res) => {
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

        const result = await runPythonEngine({
            action: "staging_status",
            repository_id: repository._id.toString()
        });

        return res.status(200).json(result);
    } catch (error) {
        return res.status(400).json({
            message: "Failed to retrieve staging area",
            error: error.message
        });
    }
};

// Unstage a file
exports.unstageFile = async (req, res) => {
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

        const { filePath } = req.body;

        if (typeof filePath !== "string" || !filePath.trim()) {
            return res.status(400).json({
                message: "A valid file path is required"
            });
        }

        const result = await runPythonEngine({
            action: "unstage_file",
            repository_id: repository._id.toString(),
            file_path: filePath
        });

        return res.status(200).json(result);
    } catch (error) {
        return res.status(400).json({
            message: "Failed to unstage file",
            error: error.message
        });
    }
};

// Unstage a staged deletion
exports.unstageDeletion = async (req, res) => {
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

        const { filePath } = req.body;

        if (typeof filePath !== "string" || !filePath.trim()) {
            return res.status(400).json({
                message: "A valid file path is required"
            });
        }

        const result = await runPythonEngine({
            action: "unstage_delete",
            repository_id: repository._id.toString(),
            file_path: filePath
        });

        return res.status(200).json(result);
    } catch (error) {
        return res.status(400).json({
            message: "Failed to unstage deletion",
            error: error.message
        });
    }
};

// Stage a deleted file
exports.stageDeletion = async (req, res) => {
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

        const { filePath } = req.body;

        if (typeof filePath !== "string" || !filePath.trim()) {
            return res.status(400).json({
                message: "A valid file path is required"
            });
        }

        const snapshot = await runPythonEngine({
            action: "get_snapshot",
            repository_id: repository._id.toString()
        });

        if (!Object.prototype.hasOwnProperty.call(
            snapshot.files || {},
            filePath
        )) {
            return res.status(400).json({
                message: "Only previously committed files can be staged as deleted"
            });
        }

        const existingFile = await RepositoryFile.findOne({
            repository: repository._id,
            path: filePath,
            type: "file"
        });

        if (existingFile) {
            return res.status(409).json({
                message: "File still exists in the working tree"
            });
        }

        const result = await runPythonEngine({
            action: "stage_delete",
            repository_id: repository._id.toString(),
            file_path: filePath
        });

        return res.status(200).json(result);
    } catch (error) {
        return res.status(400).json({
            message: "Failed to stage deletion",
            error: error.message
        });
    }
};
