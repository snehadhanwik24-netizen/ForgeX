import { useEffect, useState } from "react";
import {
    fetchRepositories,
    createRepository,
    deleteRepository
} from "../services/repositoryApi";
import RepositoryBrowser from "./RepositoryBrowser";
import "../Repositories.css";

function Repositories() {
    const [repositories, setRepositories] = useState([]);
    const [selectedRepository, setSelectedRepository] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        visibility: "private"
    });

    const loadRepositories = async () => {
        try {
            setLoading(true);
            setError("");

            const data = await fetchRepositories();
            setRepositories(data.repositories || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isCurrent = true;

        fetchRepositories()
            .then((data) => {
                if (isCurrent) {
                    setRepositories(data.repositories || []);
                }
            })
            .catch((err) => {
                if (isCurrent) {
                    setError(err.message || "Unable to load repositories");
                }
            })
            .finally(() => {
                if (isCurrent) {
                    setLoading(false);
                }
            });

        return () => {
            isCurrent = false;
        };
    }, []);

    const handleChange = (event) => {
        setFormData({
            ...formData,
            [event.target.name]: event.target.value
        });
    };

    const handleCreate = async (event) => {
        event.preventDefault();

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            await createRepository(formData);

            setFormData({
                name: "",
                description: "",
                visibility: "private"
            });

            setShowForm(false);
            setSuccess("Repository created successfully! 🎉");

            await loadRepositories();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (repositoryId) => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this repository?"
        );

        if (!confirmed) return;

        try {
            setError("");
            setSuccess("");

            await deleteRepository(repositoryId);
            setSuccess("Repository deleted successfully!");

            await loadRepositories();
        } catch (err) {
            setError(err.message);
        }
    };

    if (selectedRepository) {
        return (
            <RepositoryBrowser
                repository={selectedRepository}
                onBack={() => {
                    setSelectedRepository(null);
                    loadRepositories();
                }}
            />
        );
    }

    return (
        <div className="repositories-page">
            <div className="repositories-header">
                <div>
                    <h1>📁 Repositories</h1>
                    <p>Manage and organize your code repositories.</p>
                </div>

                <button
                    className="create-repo-button"
                    onClick={() => setShowForm(!showForm)}
                >
                    + New Repository
                </button>
            </div>

            {error && <div className="repo-message error">{error}</div>}
            {success && <div className="repo-message success">{success}</div>}

            {showForm && (
                <form className="repository-form" onSubmit={handleCreate}>
                    <h2>Create a new repository</h2>

                    <label>Repository name</label>
                    <input
                        type="text"
                        name="name"
                        placeholder="e.g. my-first-project"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        maxLength={100}
                    />

                    <label>Description</label>
                    <textarea
                        name="description"
                        placeholder="What is this repository about?"
                        value={formData.description}
                        onChange={handleChange}
                        maxLength={500}
                        rows={3}
                    />

                    <label>Visibility</label>
                    <select
                        name="visibility"
                        value={formData.visibility}
                        onChange={handleChange}
                    >
                        <option value="private">🔒 Private</option>
                        <option value="public">🌍 Public</option>
                    </select>

                    <div className="repo-form-actions">
                        <button type="submit" disabled={saving}>
                            {saving ? "Creating..." : "Create Repository"}
                        </button>

                        <button
                            type="button"
                            className="cancel-repo-button"
                            onClick={() => setShowForm(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <div className="repository-summary">
                <div className="repository-summary-card">
                    <span>Total Repositories</span>
                    <strong>{repositories.length}</strong>
                </div>

                <div className="repository-summary-card">
                    <span>Public</span>
                    <strong>
                        {repositories.filter(
                            repo => repo.visibility === "public"
                        ).length}
                    </strong>
                </div>

                <div className="repository-summary-card">
                    <span>Private</span>
                    <strong>
                        {repositories.filter(
                            repo => repo.visibility === "private"
                        ).length}
                    </strong>
                </div>
            </div>

            <div className="repository-list">
                <h2>Your Repositories</h2>

                {loading ? (
                    <p className="repo-empty">Loading repositories...</p>
                ) : repositories.length === 0 ? (
                    <div className="repo-empty">
                        <span>📂</span>
                        <h3>No repositories yet</h3>
                        <p>Create your first repository to get started.</p>
                    </div>
                ) : (
                    repositories.map(repo => (
                        <div className="repository-card" key={repo._id}>
                            <div className="repository-card-info">
                                <h3
                                    className="repository-clickable"
                                    onClick={() => setSelectedRepository(repo)}
                                >
                                    📁 {repo.name}
                                </h3>

                                <p>
                                    {repo.description ||
                                        "No description provided."}
                                </p>

                                <div className="repository-meta">
                                    <span>
                                        {repo.visibility === "public"
                                            ? "🌍 Public"
                                            : "🔒 Private"}
                                    </span>

                                    <span>
                                        🌿 {repo.defaultBranch || "main"}
                                    </span>

                                    <span>
                                        Created{" "}
                                        {new Date(
                                            repo.createdAt
                                        ).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            <div className="repository-actions">
                                <button
                                    className="open-repo-button"
                                    onClick={() =>
                                        setSelectedRepository(repo)
                                    }
                                >
                                    Open Repository →
                                </button>

                                <button
                                    className="delete-repo-button"
                                    onClick={() => handleDelete(repo._id)}
                                >
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default Repositories;

