const Repository = require("../models/Repository");
const RepositoryFile = require("../models/RepositoryFile");
const { runPythonEngine } = require("../services/pythonEngineService");

exports.createRepository = async (req, res) => {
    let repository;

    try {
        const { name, description, visibility } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                message: "Repository name is required"
            });
        }

        const slug = name.trim().toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/^-|-$/g, "");

        if (!slug) {
            return res.status(400).json({
                message: "Please provide a valid repository name"
            });
        }

        const existing = await Repository.findOne({
            owner: req.user._id,
            slug
        });

        if (existing) {
            return res.status(409).json({
                message: "You already have a repository with this name"
            });
        }

        repository = await Repository.create({
            name: name.trim(),
            description: description || "",
            visibility: visibility === "public" ? "public" : "private",
            owner: req.user._id,
            slug
        });

        await runPythonEngine({
            action: "init",
            repository_id: repository._id.toString(),
            repository_name: repository.name
        });

        return res.status(201).json({
            message: "Repository created and version control initialized successfully",
            repository
        });

    } catch (error) {
        console.error("Repository creation failed:", error);

        if (repository) {
            let storageCleanupSucceeded = false;

            try {
                await runPythonEngine({
                    action: "delete",
                    repository_id: repository._id.toString()
                });

                storageCleanupSucceeded = true;
                console.log("Python storage rollback completed.");
            } catch (cleanupError) {
                console.error("Python storage rollback failed:", cleanupError);
            }

            if (storageCleanupSucceeded) {
                try {
                    await RepositoryFile.deleteMany({
                        repository: repository._id
                    });

                    await Repository.deleteOne({
                        _id: repository._id
                    });

                    console.log("MongoDB repository rollback completed.");
                } catch (cleanupError) {
                    console.error("MongoDB rollback failed:", cleanupError);
                }
            } else {
                console.error(
                    "MongoDB records retained because Python cleanup failed. Retry cleanup later."
                );
            }
        }

        return res.status(500).json({
            message: "Failed to create and initialize repository"
        });
    }
};

exports.getRepositories = async (req, res) => {
    try {
        const repositories = await Repository.find({
            owner: req.user._id
        }).sort({ createdAt: -1 });

        return res.json({
            count: repositories.length,
            repositories
        });

    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch repositories"
        });
    }
};

exports.getRepository = async (req, res) => {
    try {
        const repository = await Repository.findOne({
            _id: req.params.id,
            owner: req.user._id
        });

        if (!repository) {
            return res.status(404).json({
                message: "Repository not found"
            });
        }

        return res.json({ repository });

    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch repository"
        });
    }
};

exports.deleteRepository = async (req, res) => {
    let storageDeleted = false;

    try {
        const repository = await Repository.findOne({
            _id: req.params.id,
            owner: req.user._id
        });

        if (!repository) {
            return res.status(404).json({
                message: "Repository not found"
            });
        }

        await runPythonEngine({
            action: "delete",
            repository_id: repository._id.toString()
        });

        storageDeleted = true;

        await RepositoryFile.deleteMany({
            repository: repository._id
        });

        const result = await Repository.deleteOne({
            _id: repository._id,
            owner: req.user._id
        });

        if (result.deletedCount !== 1) {
            throw new Error("Repository database record was not deleted");
        }

        return res.json({
            message: "Repository and all associated data deleted successfully"
        });

    } catch (error) {
        console.error("Repository deletion failed:", error);

        return res.status(500).json({
            message: storageDeleted
                ? "Repository storage was deleted, but database cleanup failed. Retry the deletion to finish cleanup."
                : "Repository deletion failed. No database records were intentionally removed."
        });
    }
};


