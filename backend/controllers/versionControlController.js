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


// Merge a source branch into the currently active branch.
exports.mergeBranch = async (req, res) => {
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

        const { sourceBranch, message } = req.body;

        if (
            typeof sourceBranch !== "string" ||
            !sourceBranch.trim()
        ) {
            return res.status(400).json({
                message: "Source branch is required"
            });
        }

        // Check whether the working tree has uncommitted changes.
        const currentSnapshot = await runPythonEngine({
            action: "get_snapshot",
            repository_id: repository._id.toString()
        });

        const documents = await RepositoryFile.find({
            repository: repository._id,
            type: "file"
        }).lean();

        const committedFiles = currentSnapshot.files || {};
        const workingFiles = new Map(
            documents.map(file => [file.path, file.content || ""])
        );

        const allPaths = new Set([
            ...Object.keys(committedFiles),
            ...workingFiles.keys()
        ]);

        const dirtyFiles = [];

        for (const filePath of allPaths) {
            if (
                !Object.prototype.hasOwnProperty.call(
                    committedFiles,
                    filePath
                ) ||
                !workingFiles.has(filePath) ||
                committedFiles[filePath] !== workingFiles.get(filePath)
            ) {
                dirtyFiles.push(filePath);
            }
        }

        if (dirtyFiles.length > 0) {
            return res.status(409).json({
                message: "Commit or discard working-tree changes before merging.",
                dirtyFiles
            });
        }

        // Execute merge using the Python version-control engine.
        const result = await runPythonEngine({
            action: "merge",
            repository_id: repository._id.toString(),
            source_branch: sourceBranch.trim(),
            message: typeof message === "string" ? message.trim() : undefined
        });

        if (result.status === "conflict") {
            return res.status(409).json({
                message: "Merge conflicts detected. The target branch was not changed.",
                conflicts: result.conflicts || [],
                merge: result
            });
        }

        if (result.status === "up_to_date") {
            return res.status(200).json({
                message: "Branches are already up to date.",
                merge: result
            });
        }

        if (
            result.status !== "merged" &&
            result.status !== "fast_forward"
        ) {
            return res.status(400).json({
                message: "Merge could not be completed.",
                merge: result
            });
        }

        const destinationFiles = result.files || {};
        const desiredDocuments = new Map();

        // Reconstruct parent folders and prepare destination files.
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

        // Update destination files and folders.
        if (desiredDocuments.size > 0) {
            await RepositoryFile.bulkWrite(
                [...desiredDocuments.values()].map(document => ({
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

        // Remove paths that do not exist in the merged snapshot.
        await RepositoryFile.deleteMany({
            repository: repository._id,
            path: { $nin: desiredPaths }
        });

        return res.status(200).json({
            message: result.status === "fast_forward"
                ? "Branch fast-forwarded successfully."
                : "Branches merged successfully.",
            merge: result,
            fileCount: Object.keys(destinationFiles).length,
            files: destinationFiles
        });

    } catch (error) {
        return res.status(400).json({
            message: "Failed to merge branches",
            error: error.message
        });
    }
};


exports.getConflictDetails = async (req, res) => {
    try {
        const repository = await findOwnedRepository(
            req.params.repositoryId,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({ message: "Repository not found" });
        }

        const { sourceBranch } = req.body;

        if (typeof sourceBranch !== "string" || !sourceBranch.trim()) {
            return res.status(400).json({ message: "Source branch is required" });
        }

        const currentSnapshot = await runPythonEngine({
            action: "get_snapshot",
            repository_id: repository._id.toString()
        });

        const documents = await RepositoryFile.find({
            repository: repository._id,
            type: "file"
        }).lean();

        const committedFiles = currentSnapshot.files || {};
        const workingFiles = new Map(
            documents.map(file => [file.path, file.content || ""])
        );

        const allPaths = new Set([
            ...Object.keys(committedFiles),
            ...workingFiles.keys()
        ]);

        const dirtyFiles = [...allPaths].filter(filePath =>
            !Object.prototype.hasOwnProperty.call(committedFiles, filePath) ||
            !workingFiles.has(filePath) ||
            committedFiles[filePath] !== workingFiles.get(filePath)
        );

        if (dirtyFiles.length) {
            return res.status(409).json({
                message: "Commit or discard working-tree changes first.",
                dirtyFiles
            });
        }

        const result = await runPythonEngine({
            action: "get_conflict_details",
            repository_id: repository._id.toString(),
            source_branch: sourceBranch.trim()
        });

        return res.status(200).json(result);

    } catch (error) {
        return res.status(400).json({
            message: "Failed to retrieve conflict details",
            error: error.message
        });
    }
};

exports.resolveConflicts = async (req, res) => {
    try {
        const repository = await findOwnedRepository(
            req.params.repositoryId,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({ message: "Repository not found" });
        }

        const { sourceBranch, resolvedFiles, message } = req.body;

        if (
            typeof sourceBranch !== "string" ||
            !sourceBranch.trim() ||
            !resolvedFiles ||
            typeof resolvedFiles !== "object" ||
            Array.isArray(resolvedFiles)
        ) {
            return res.status(400).json({
                message: "Source branch and resolved files are required"
            });
        }

        const currentSnapshot = await runPythonEngine({
            action: "get_snapshot",
            repository_id: repository._id.toString()
        });

        const documents = await RepositoryFile.find({
            repository: repository._id,
            type: "file"
        }).lean();

        const committedFiles = currentSnapshot.files || {};
        const workingFiles = new Map(
            documents.map(file => [file.path, file.content || ""])
        );

        const allPaths = new Set([
            ...Object.keys(committedFiles),
            ...workingFiles.keys()
        ]);

        const dirtyFiles = [...allPaths].filter(filePath =>
            !Object.prototype.hasOwnProperty.call(committedFiles, filePath) ||
            !workingFiles.has(filePath) ||
            committedFiles[filePath] !== workingFiles.get(filePath)
        );

        if (dirtyFiles.length) {
            return res.status(409).json({
                message: "Commit or discard working-tree changes first.",
                dirtyFiles
            });
        }

        const result = await runPythonEngine({
            action: "resolve_conflicts",
            repository_id: repository._id.toString(),
            source_branch: sourceBranch.trim(),
            resolved_files: resolvedFiles,
            message
        });

        if (result.status !== "merged") {
            return res.status(400).json({
                message: "Conflict resolution was not completed",
                merge: result
            });
        }

        const destinationFiles = result.files || {};
        const desiredDocuments = new Map();

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

        if (desiredDocuments.size) {
            await RepositoryFile.bulkWrite(
                [...desiredDocuments.values()].map(document => ({
                    updateOne: {
                        filter: {
                            repository: repository._id,
                            path: document.path
                        },
                        update: { $set: document },
                        upsert: true
                    }
                }))
            );
        }

        await RepositoryFile.deleteMany({
            repository: repository._id,
            path: { $nin: desiredPaths }
        });

        return res.status(200).json({
            message: "Conflicts resolved and branches merged successfully.",
            merge: result,
            files: destinationFiles,
            fileCount: Object.keys(destinationFiles).length
        });

    } catch (error) {
        return res.status(400).json({
            message: "Failed to resolve conflicts",
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


// ForgeX Batch 3: history operations and release management.

async function syncHistoryOperationFiles(repositoryId, files) {
    if (!files || typeof files !== "object" || Array.isArray(files)) {
        throw new Error("Engine did not return a valid repository snapshot");
    }

    const desired = new Map();

    for (const [filePath, content] of Object.entries(files)) {
        const normalized = filePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
        if (!normalized || normalized.split("/").some(part => !part || part === "." || part === "..")) {
            throw new Error("Engine returned an unsafe file path");
        }

        const segments = normalized.split("/");
        for (let i = 1; i < segments.length; i++) {
            const folderPath = segments.slice(0, i).join("/");
            desired.set(folderPath, {
                repository: repositoryId,
                path: folderPath,
                name: segments[i - 1],
                type: "folder",
                content: "",
                size: 0
            });
        }

        desired.set(normalized, {
            repository: repositoryId,
            path: normalized,
            name: segments[segments.length - 1],
            type: "file",
            content: String(content),
            size: Buffer.byteLength(String(content), "utf8")
        });
    }

    const existing = await RepositoryFile.find({ repository: repositoryId });
    const existingByPath = new Map(existing.map(file => [file.path, file]));
    const operations = [];

    for (const [filePath, document] of desired) {
        const current = existingByPath.get(filePath);
        if (current) {
            operations.push({
                updateOne: {
                    filter: { _id: current._id },
                    update: {
                        $set: {
                            name: document.name,
                            type: document.type,
                            content: document.content,
                            size: document.size
                        }
                    }
                }
            });
        } else {
            operations.push({
                insertOne: { document }
            });
        }
    }

    if (operations.length) {
        await RepositoryFile.bulkWrite(operations);
    }

    const stalePaths = existing
        .filter(file => !desired.has(file.path))
        .map(file => file._id);

    if (stalePaths.length) {
        await RepositoryFile.deleteMany({ _id: { $in: stalePaths } });
    }
}

async function runHistoryOperation(req, res, action) {
    try {
        const repository = await findOwnedRepository(
            req.params.repositoryId,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({
                success: false,
                message: "Repository not found"
            });
        }

        const engineResult = await runPythonEngine({
            action,
            repository_id: repository._id.toString(),
            commit_id: req.body.commit_id,
            message: req.body.message,
            mainline_parent: req.body.mainline_parent
        });

        const result = engineResult.data ?? engineResult;

        if (result.status === "conflict") {
            return res.status(409).json({
                success: false,
                status: "conflict",
                conflicts: result.conflicts || [],
                message: "Operation stopped because some files conflict"
            });
        }

        if (action === "revert" && result.status !== "reverted") {
            throw new Error("Unexpected revert result from engine");
        }
        if (action === "cherry_pick" && result.status !== "cherry_picked") {
            throw new Error("Unexpected cherry-pick result from engine");
        }

        await syncHistoryOperationFiles(repository._id, result.files);

        return res.status(200).json({
            success: true,
            data: {
                status: result.status,
                commit: result.commit
            }
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message || "History operation failed"
        });
    }
}

async function revertCommit(req, res) {
    return runHistoryOperation(req, res, "revert");
}

async function cherryPickCommit(req, res) {
    return runHistoryOperation(req, res, "cherry_pick");
}

async function runMetadataOperation(req, res, action) {
    try {
        req.body = req.body || {};

        const repository = await findOwnedRepository(
            req.params.repositoryId,
            req.user._id
        );

        if (!repository) {
            return res.status(404).json({
                success: false,
                message: "Repository not found"
            });
        }

        const engineResult = await runPythonEngine({
            action,
            repository_id: repository._id.toString(),
            name: req.body.name,
            commit_id: req.body.commit_id,
            message: req.body.message,
            title: req.body.title,
            tag_name: req.body.tag_name,
            description: req.body.description
        });

        return res.status(200).json({
            success: true,
            data: engineResult.data ?? engineResult
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message || "Metadata operation failed"
        });
    }
}

async function createRepositoryTag(req, res) {
    return runMetadataOperation(req, res, "create_tag");
}

async function getRepositoryTags(req, res) {
    return runMetadataOperation(req, res, "list_tags");
}

async function createRepositoryRelease(req, res) {
    return runMetadataOperation(req, res, "create_release");
}

async function getRepositoryReleases(req, res) {
    return runMetadataOperation(req, res, "list_releases");
}

module.exports.revertCommit = revertCommit;
module.exports.cherryPickCommit = cherryPickCommit;
module.exports.createRepositoryTag = createRepositoryTag;
module.exports.getRepositoryTags = getRepositoryTags;
module.exports.createRepositoryRelease = createRepositoryRelease;
module.exports.getRepositoryReleases = getRepositoryReleases;
