import { useEffect, useState } from "react";
import { fetchCommitHistory, fetchFileDiff } from "../services/commitApi";
import { DiffEditor } from "@monaco-editor/react";
import "../Commits.css";
import BranchManager from "../components/BranchManager";

const REPOSITORIES = [
    {
        id: "6af6becfe9a43f823186c8e0",
        name: "Engine Integration Test"
    }
];

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
}

function Commits() {
    const [selectedRepository, setSelectedRepository] = useState(
        REPOSITORIES[0].id
    );
    const [commits, setCommits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [oldCommitId, setOldCommitId] = useState("");
    const [newCommitId, setNewCommitId] = useState("");
    const [diffPath, setDiffPath] = useState("");
    const [diffData, setDiffData] = useState(null);
    const [diffLoading, setDiffLoading] = useState(false);
    const [diffError, setDiffError] = useState("");

    const loadCommits = async () => {
        try {
            setLoading(true);
            setError("");

            const data = await fetchCommitHistory(selectedRepository);
            setCommits(data.commits || []);
        } catch (err) {
            setError(err.message || "Unable to load commit history");
        } finally {
            setLoading(false);
        }
    };

    const changedPaths = [...new Set(
        commits.flatMap(commit => [
            ...Object.keys(commit.files || {}),
            ...(commit.deleted_files || [])
        ])
    )].sort();

    const compareCommits = async () => {
        if (!oldCommitId || !newCommitId || !diffPath) {
            setDiffError("Select both commits and a file.");
            return;
        }

        if (oldCommitId === newCommitId) {
            setDiffError("Choose two different commits.");
            return;
        }

        try {
            setDiffLoading(true);
            setDiffError("");
            setDiffData(null);

            const result = await fetchFileDiff(
                selectedRepository,
                oldCommitId,
                newCommitId,
                diffPath
            );

            setDiffData(result);
        } catch (err) {
            setDiffError(err.message);
        } finally {
            setDiffLoading(false);
        }
    };

    useEffect(() => {
        let isCurrent = true;

        fetchCommitHistory(selectedRepository)
            .then((data) => {
                if (isCurrent) {
                    setCommits(data.commits || []);
                }
            })
            .catch((err) => {
                if (isCurrent) {
                    setError(err.message || "Unable to load commit history");
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
    }, [selectedRepository]);

    return (
        <div className="commits-page">
            <div className="commits-heading">
                <div>
                    <p className="eyebrow">VERSION CONTROL</p>
                    <h1>Commit History</h1>
                    <p>Track every change made to your repositories.</p>
                </div>

                <button
                    className="commit-refresh-button"
                    onClick={loadCommits}
                    disabled={loading}
                >
                    ? Refresh
                </button>
            </div>

            <BranchManager
                repositoryId={selectedRepository}
                onBranchChanged={loadCommits}
            />

            <div className="commit-summary-grid">
                <div className="commit-summary-card">
                    <span>Total Commits</span>
                    <h2>{commits.length}</h2>
                    <small>Recorded changes</small>
                </div>

                <div className="commit-summary-card">
                    <span>Repository</span>
                    <h2>{REPOSITORIES.find(
                        repo => repo.id === selectedRepository
                    )?.name}</h2>
                    <small>Selected repository</small>
                </div>
            </div>

            <div className="commit-toolbar">
                <div>
                    <h3>All Commits</h3>
                    <p>Newest commits appear first.</p>
                </div>

                <select
                    value={selectedRepository}
                    onChange={event =>
                        setSelectedRepository(event.target.value)
                    }
                >
                    {REPOSITORIES.map(repo => (
                        <option key={repo.id} value={repo.id}>
                            {repo.name}
                        </option>
                    ))}
                </select>
            </div>

            <section className="commit-summary-card" style={{
                marginBottom: "24px",
                padding: "20px"
            }}>
                <h2>File Diff Viewer</h2>
                <p>Compare file changes between two commits.</p>

                <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "16px"
                }}>
                    <select
                        value={oldCommitId}
                        onChange={event => setOldCommitId(event.target.value)}
                    >
                        <option value="">Select older commit</option>
                        {commits.map(commit => (
                            <option key={commit.commit_id} value={commit.commit_id}>
                                {commit.message}
                            </option>
                        ))}
                    </select>

                    <select
                        value={newCommitId}
                        onChange={event => setNewCommitId(event.target.value)}
                    >
                        <option value="">Select newer commit</option>
                        {commits.map(commit => (
                            <option key={commit.commit_id} value={commit.commit_id}>
                                {commit.message}
                            </option>
                        ))}
                    </select>

                    <select
                        value={diffPath}
                        onChange={event => setDiffPath(event.target.value)}
                    >
                        <option value="">Select file</option>
                        {changedPaths.map(path => (
                            <option key={path} value={path}>{path}</option>
                        ))}
                    </select>

                    <button
                        onClick={compareCommits}
                        disabled={diffLoading}
                    >
                        {diffLoading ? "Comparing..." : "Compare"}
                    </button>
                </div>

                {diffError && (
                    <p role="alert" style={{ color: "crimson" }}>
                        {diffError}
                    </p>
                )}

                {diffData && (
                    <div>
                        <h3>{diffData.file_path}</h3>
                        <DiffEditor
                            height="450px"
                            language="plaintext"
                            theme="vs-dark"
                            original={diffData.old_content}
                            modified={diffData.new_content}
                            options={{
                                readOnly: true,
                                renderSideBySide: true,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                automaticLayout: true
                            }}
                        />
                    </div>
                )}
            </section>

            {loading ? (
                <div className="commit-empty-state">
                    Loading commit history...
                </div>
            ) : error ? (
                <div className="commit-error">
                    {error}
                    <button onClick={loadCommits}>Try Again</button>
                </div>
            ) : commits.length === 0 ? (
                <div className="commit-empty-state">
                    <div>??</div>
                    <h3>No commits yet</h3>
                    <p>Your repository commits will appear here.</p>
                </div>
            ) : (
                <div className="commit-list">
                    {commits.map((commit, index) => (
                        <article
                            className="commit-card"
                            key={commit.commit_id}
                        >
                            <div className="commit-marker">
                                <span>?</span>
                                {index !== commits.length - 1 && (
                                    <div className="commit-line"></div>
                                )}
                            </div>

                            <div className="commit-details">
                                <div className="commit-title-row">
                                    <h3>{commit.message}</h3>
                                    <span className="commit-number">
                                        #{commits.length - index}
                                    </span>
                                </div>

                                <div className="commit-meta">
                                    <span>?? {formatDate(commit.timestamp)}</span>
                                    <span>?? {Object.keys(commit.files || {}).length} file(s)</span>
                                </div>

                                <div className="commit-id">
                                    <span>Commit ID:</span>
                                    <code>{commit.commit_id}</code>
                                    <button
                                        onClick={() =>
                                            navigator.clipboard.writeText(
                                                commit.commit_id
                                            )
                                        }
                                    >
                                        Copy
                                    </button>
                                </div>

                                <div className="commit-id">
                                    <span>Parent:</span>
                                    <code>
                                        {commit.parent || "Initial commit"}
                                    </code>
                                </div>

                                <div className="commit-files">
                                    <strong>Files:</strong>
                                    {Object.entries(commit.files || {}).map(
                                        ([path, hash]) => (
                                            <div key={path}>
                                                ?? {path}
                                                <small>{hash}</small>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Commits;



