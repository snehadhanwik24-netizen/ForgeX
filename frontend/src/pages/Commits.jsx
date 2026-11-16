import HistoryActions from "../components/HistoryActions";
import CommitIntelligence from "../components/CommitIntelligence";
import ReleaseCenter from "../components/ReleaseCenter";
import { useEffect, useState } from "react";
import { fetchCommitHistory, fetchFileDiff } from "../services/commitApi";
import { fetchDashboardRepositories } from "../services/dashboardApi";
import { DiffEditor } from "@monaco-editor/react";
import "../Commits.css";
import BranchManager from "../components/BranchManager";


import RepositoryInsights from "../components/RepositoryInsights";
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
}

function getMonacoLanguage(filePath = "") {
    const extension = filePath.split(".").pop().toLowerCase();

    const languages = {
        js: "javascript", jsx: "javascript", mjs: "javascript",
        cjs: "javascript", ts: "typescript", tsx: "typescript",
        py: "python", java: "java", c: "c", cpp: "cpp",
        h: "cpp", hpp: "cpp", cs: "csharp",
        html: "html", htm: "html", css: "css",
        scss: "scss", json: "json", md: "markdown",
        xml: "xml", sql: "sql", sh: "shell",
        bash: "shell", yml: "yaml", yaml: "yaml",
        php: "php", rb: "ruby", go: "go",
        rs: "rust", swift: "swift", kt: "kotlin",
        txt: "plaintext"
    };

    return languages[extension] || "plaintext";
}

function getDiffStats(oldContent = "", newContent = "") {
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");

    let added = 0;
    let deleted = 0;

    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    newLines.forEach(line => {
        if (line.trim() && !oldSet.has(line)) added++;
    });

    oldLines.forEach(line => {
        if (line.trim() && !newSet.has(line)) deleted++;
    });

    return { added, deleted };
}

function Commits() {
    const [repositories, setRepositories] = useState([]);
    const [selectedRepository, setSelectedRepository] = useState("");
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
        let active = true;

        const loadRepositories = async () => {
            try {
                setError("");
                const data = await fetchDashboardRepositories();
                const items = Array.isArray(data.repositories)
                    ? data.repositories
                    : [];

                if (!active) return;

                setRepositories(items);

                setSelectedRepository(current => {
                    const exists = items.some(
                        repo => String(repo._id || repo.id) === current
                    );

                    if (exists) return current;

                    return items.length
                        ? String(items[0]._id || items[0].id)
                        : "";
                });
            } catch (err) {
                if (active) setError(err.message || "Unable to load repositories");
            }
        };

        loadRepositories();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let isCurrent = true;

        if (!selectedRepository) {
            return () => { isCurrent = false; };
        }

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

            {selectedRepository && (
                <>
                <HistoryActions repositoryId={selectedRepository?._id || selectedRepository?.id || selectedRepository} commits={commits} />
<BranchManager
                    repositoryId={selectedRepository}
                    onBranchChanged={loadCommits}
                />
                <ReleaseCenter repositoryId={selectedRepository} commits={commits} />
                <CommitIntelligence commits={commits} repositoryId={selectedRepository} />
                <RepositoryInsights commits={commits} repositoryId={selectedRepository} />
                </>
            )}

            <div className="commit-summary-grid">
                <div className="commit-summary-card">
                    <span>Total Commits</span>
                    <h2>{commits.length}</h2>
                    <small>Recorded changes</small>
                </div>

                <div className="commit-summary-card">
                    <span>Repository</span>
                    <h2>{repositories.find(repo => String(repo._id || repo.id) === selectedRepository)?.name || "No repository selected"}</h2>
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
                    {repositories.map(repo => {
                        const id = String(repo._id || repo.id);
                        return (
                            <option key={id} value={id}>
                                {repo.name}
                            </option>
                        );
                    })}
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
                        <h3 className="review-file-heading">{diffData.file_path}</h3>
                        {(() => {
                            const stats = getDiffStats(
                                diffData.old_content || "",
                                diffData.new_content || ""
                            );
                            return (
                                <div className="review-diff-stats">
                                    <span className="review-added">+{stats.added} added</span>
                                    <span className="review-deleted">−{stats.deleted} deleted</span>
                                    <span className="review-language">
                                        {getMonacoLanguage(diffData.file_path || diffPath)}
                                    </span>
                                </div>
                            );
                        })()}
                        <DiffEditor
                            height="450px"
                            language={getMonacoLanguage(diffData.file_path || diffPath)}
                            theme="vs-dark"
                            original={diffData.old_content}
                            modified={diffData.new_content}
                            options={{
                                readOnly: true,
                                originalEditable: false,
                                renderSideBySide: true,
                                automaticLayout: true,
                                minimap: { enabled: false },
                                lineNumbers: "on",
                                scrollBeyondLastLine: false,
                                wordWrap: "on",
                                renderIndicators: true,
                                renderOverviewRuler: true,
                                overviewRulerLanes: 3,
                                diffAlgorithm: "advanced",
                                ignoreTrimWhitespace: false,
                                folding: true,
                                fontSize: 13,
                                padding: { top: 12, bottom: 12 },
                                scrollbar: {
                                    verticalScrollbarSize: 10,
                                    horizontalScrollbarSize: 10
                                }
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
                                    {commit.is_merge && (
                                        <span style={{
                                            marginLeft: "10px",
                                            padding: "4px 9px",
                                            borderRadius: "12px",
                                            background: "#245c45",
                                            color: "#9af0c2",
                                            fontSize: "11px",
                                            fontWeight: 700
                                        }}>
                                            MERGE
                                        </span>
                                    )}
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

                                {commit.second_parent && (
                                    <div className="commit-id">
                                        <span>Second parent:</span>
                                        <code>{commit.second_parent}</code>
                                    </div>
                                )}

                                {commit.source_branch && (
                                    <div className="commit-id">
                                        <span>Merged from:</span>
                                        <code>{commit.source_branch}</code>
                                    </div>
                                )}

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
