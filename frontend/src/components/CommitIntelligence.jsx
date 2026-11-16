import { useMemo, useState } from "react";
import { fetchFileDiff } from "../services/commitApi";
import { DiffEditor } from "@monaco-editor/react";
import "./CommitIntelligence.css";


function reviewLanguage(filePath = "") {
    const ext = filePath.split(".").pop().toLowerCase();
    const map = {
        js: "javascript", jsx: "javascript", mjs: "javascript",
        ts: "typescript", tsx: "typescript",
        py: "python", java: "java", c: "c", cpp: "cpp",
        h: "cpp", html: "html", css: "css", scss: "scss",
        json: "json", md: "markdown", xml: "xml", sql: "sql",
        sh: "shell", bash: "shell", yml: "yaml", yaml: "yaml",
        php: "php", go: "go", rs: "rust", txt: "plaintext"
    };
    return map[ext] || "plaintext";
}
function shortId(value) {
    return value ? value.slice(0, 10) : "Initial";
}

function getSnapshot(commit) {
    return commit && commit.snapshot && typeof commit.snapshot === "object"
        ? commit.snapshot
        : null;
}

export default function CommitIntelligence({ commits = [], repositoryId }) {
    const [search, setSearch] = useState("");
    const [baseId, setBaseId] = useState("");
    const [targetId, setTargetId] = useState("");
    const [selectedCommitDetail, setSelectedCommitDetail] = useState(null);
    const [selectedFile, setSelectedFile] = useState("");
    const [fileDiff, setFileDiff] = useState(null);
    const [fileDiffLoading, setFileDiffLoading] = useState(false);
    const [fileDiffError, setFileDiffError] = useState("");

    const ordered = useMemo(() => {
        return [...commits].sort(
            (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
        );
    }, [commits]);

    const base = ordered.find(item => item.commit_id === baseId) || ordered[ordered.length - 1];
    const target = ordered.find(item => item.commit_id === targetId) || ordered[0];

    const filtered = ordered.filter(commit => {
        const query = search.trim().toLowerCase();
        if (!query) return true;

        return [
            commit.message,
            commit.branch,
            commit.commit_id,
            commit.source_branch
        ].some(value => String(value || "").toLowerCase().includes(query));
    });

    const comparison = useMemo(() => {
        const oldSnapshot = getSnapshot(base);
        const newSnapshot = getSnapshot(target);

        if (!oldSnapshot || !newSnapshot) {
            return {
                available: false,
                added: [],
                modified: [],
                deleted: []
            };
        }

        const oldPaths = new Set(Object.keys(oldSnapshot));
        const newPaths = new Set(Object.keys(newSnapshot));

        const added = [...newPaths].filter(path => !oldPaths.has(path));
        const deleted = [...oldPaths].filter(path => !newPaths.has(path));
        const modified = [...newPaths].filter(
            path => oldPaths.has(path) && oldSnapshot[path] !== newSnapshot[path]
        );

        return { available: true, added, modified, deleted };
    }, [base, target]);


    const loadFileDiff = async (path) => {
        if (!repositoryId || !base?.commit_id || !target?.commit_id) {
            setFileDiffError("Select a repository and two valid commits.");
            return;
        }

        setSelectedFile(path);
        setFileDiff(null);
        setFileDiffError("");

        if (base.commit_id === target.commit_id) {
            setFileDiffError("Choose two different commits.");
            return;
        }

        try {
            setFileDiffLoading(true);
            const result = await fetchFileDiff(
                repositoryId,
                base.commit_id,
                target.commit_id,
                path
            );
            setFileDiff(result);
        } catch (error) {
            setFileDiffError(error.message || "Unable to load file comparison.");
        } finally {
            setFileDiffLoading(false);
        }
    };
    const totalChanges =
        comparison.added.length +
        comparison.modified.length +
        comparison.deleted.length;

    return (
        <section className="commit-intelligence">
            <div className="commit-intelligence__heading">
                <div>
                    <span className="commit-intelligence__eyebrow">
                        DEVELOPER INSIGHTS
                    </span>
                    <h2>Commit Intelligence</h2>
                    <p>Explore repository history and compare development snapshots.</p>
                </div>
                <span className="commit-intelligence__count">
                    {commits.length} commits
                </span>
            </div>

            <div className="commit-intelligence__panel">
                <div className="commit-intelligence__panel-title">
                    <div>
                        <h3>Visual commit history</h3>
                        <p>Explore parent relationships and merge history.</p>
                    </div>
                </div>

                <input
                    className="commit-intelligence__search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search commits, branches or commit IDs..."
                    aria-label="Search commit history"
                />

                <div className="commit-intelligence__graph">
                    {filtered.length === 0 && (
                        <div className="commit-intelligence__empty">
                            No commits match your search.
                        </div>
                    )}

                    {filtered.slice(0, 40).map((commit, index) => (
                        <div className="commit-intelligence__node" key={commit.commit_id}>
                            <div className="commit-intelligence__rail">
                                <span className={
                                    commit.is_merge
                                        ? "commit-intelligence__dot commit-intelligence__dot--merge"
                                        : "commit-intelligence__dot"
                                } />
                                {index !== filtered.length - 1 && (
                                    <span className="commit-intelligence__line" />
                                )}
                            </div>

                            <div className="commit-intelligence__node-content">
                                <div className="commit-intelligence__node-top">
                                    <strong>{commit.message || "Untitled commit"}</strong>
                                    <span className="commit-intelligence__type">
                                        {commit.is_merge ? "MERGE" : "COMMIT"}
                                    </span>
                                </div>

                                <div className="commit-intelligence__metadata">
                                    <code>{shortId(commit.commit_id)}</code>
                                    <span>{commit.branch || "Unknown branch"}</span>
                                    <time>
                                        {commit.timestamp
                                            ? new Date(commit.timestamp).toLocaleString()
                                            : "Date unavailable"}
                                    </time>
                                </div>

                                <div className="commit-intelligence__parents">
                                    <span>Parent: {shortId(commit.parent)}</span>
                                    {commit.second_parent && (
                                        <span>
                                            Second parent: {shortId(commit.second_parent)}
                                        </span>
                                    )}
                                    {commit.source_branch && (
                                        <span>Merged from: {commit.source_branch}</span>
                                    )}
                                </div>

                                <div className="commit-intelligence__select">
                                    <button
                                        type="button"
                                        onClick={() => setBaseId(commit.commit_id)}
                                    >
                                        Set as base
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTargetId(commit.commit_id)}
                                    >
                                        Set as target
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCommitDetail(commit)}
                                    >
                                        Inspect commit
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {selectedCommitDetail && (
                <div className="commit-inspector-overlay" onClick={() => setSelectedCommitDetail(null)}>
                    <section
                        className="commit-inspector"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Commit details"
                        onClick={event => event.stopPropagation()}
                    >
                        <div className="commit-inspector__header">
                            <div>
                                <span>COMMIT INSPECTOR</span>
                                <h2>{selectedCommitDetail.message}</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedCommitDetail(null)}
                                aria-label="Close commit inspector"
                            >
                                ×
                            </button>
                        </div>

                        <div className="commit-inspector__metadata">
                            <div>
                                <span>Commit ID</span>
                                <code>{selectedCommitDetail.commit_id}</code>
                                <button
                                    type="button"
                                    onClick={() => navigator.clipboard.writeText(selectedCommitDetail.commit_id)}
                                >
                                    Copy full hash
                                </button>
                            </div>
                            <div>
                                <span>Branch</span>
                                <strong>{selectedCommitDetail.branch || "Unknown"}</strong>
                            </div>
                            <div>
                                <span>Authoring time</span>
                                <strong>
                                    {selectedCommitDetail.timestamp
                                        ? new Date(selectedCommitDetail.timestamp).toLocaleString()
                                        : "Unavailable"}
                                </strong>
                            </div>
                            <div>
                                <span>Commit type</span>
                                <strong>{selectedCommitDetail.is_merge ? "Merge commit" : "Regular commit"}</strong>
                            </div>
                        </div>

                        <div className="commit-inspector__parents">
                            <h3>Commit ancestry</h3>
                            <div>
                                <span>First parent</span>
                                <code>{selectedCommitDetail.parent || "Initial commit"}</code>
                                {selectedCommitDetail.parent && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const parent = commits.find(item => item.commit_id === selectedCommitDetail.parent);
                                            if (parent) setSelectedCommitDetail(parent);
                                        }}
                                    >
                                        Open parent
                                    </button>
                                )}
                            </div>

                            {selectedCommitDetail.second_parent && (
                                <div>
                                    <span>Second parent</span>
                                    <code>{selectedCommitDetail.second_parent}</code>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const parent = commits.find(item => item.commit_id === selectedCommitDetail.second_parent);
                                            if (parent) setSelectedCommitDetail(parent);
                                        }}
                                    >
                                        Open second parent
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="commit-inspector__files">
                            <h3>Files recorded in this commit</h3>
                            {[
                                ["Added / modified", Object.keys(selectedCommitDetail.files || {})],
                                ["Deleted", selectedCommitDetail.deleted_files || []]
                            ].map(([heading, paths]) => (
                                <div key={heading}>
                                    <h4>{heading} ({paths.length})</h4>
                                    {paths.length === 0 ? (
                                        <p>No files recorded.</p>
                                    ) : paths.map(path => (
                                        <code key={path}>{path}</code>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            )}
            <div className="commit-intelligence__panel">
                <div className="commit-intelligence__panel-title">
                    <div>
                        <h3>Compare commits</h3>
                        <p>Compare two repository snapshots without changing history.</p>
                    </div>
                </div>

                <div className="commit-intelligence__selectors">
                    <div>
                        <label htmlFor="comparison-base">Base commit</label>
                        <select
                            id="comparison-base"
                            value={base?.commit_id || ""}
                            onChange={event => setBaseId(event.target.value)}
                        >
                            {ordered.map(commit => (
                                <option key={commit.commit_id} value={commit.commit_id}>
                                    {shortId(commit.commit_id)} — {commit.message}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="comparison-target">Target commit</label>
                        <select
                            id="comparison-target"
                            value={target?.commit_id || ""}
                            onChange={event => setTargetId(event.target.value)}
                        >
                            {ordered.map(commit => (
                                <option key={commit.commit_id} value={commit.commit_id}>
                                    {shortId(commit.commit_id)} — {commit.message}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {!base || !target ? (
                    <div className="commit-intelligence__empty">
                        At least one commit is required for comparison.
                    </div>
                ) : !comparison.available ? (
                    <div className="commit-intelligence__empty">
                        Full snapshots are unavailable for these commits. Select commits
                        with stored snapshots to compare file changes.
                    </div>
                ) : (
                    <>
                        <div className="commit-intelligence__summary">
                            <div>
                                <span>Added</span>
                                <strong>{comparison.added.length}</strong>
                            </div>
                            <div>
                                <span>Modified</span>
                                <strong>{comparison.modified.length}</strong>
                            </div>
                            <div>
                                <span>Deleted</span>
                                <strong>{comparison.deleted.length}</strong>
                            </div>
                            <div>
                                <span>Total changes</span>
                                <strong>{totalChanges}</strong>
                            </div>
                        </div>

                        <div className="commit-intelligence__files">
                            {[
                                ["Added files", comparison.added],
                                ["Modified files", comparison.modified],
                                ["Deleted files", comparison.deleted]
                            ].map(([heading, paths]) => (
                                <div key={heading}>
                                    <h4>{heading}</h4>
                                    {paths.length === 0 ? (
                                        <p className="commit-intelligence__empty">
                                            No files
                                        </p>
                                    ) : (
                                        paths.map(path => (
                                            <button
                                                type="button"
                                                className={`commit-intelligence__file review-file-button ${selectedFile === path ? "review-file-selected" : ""}`}
                                                key={path}
                                                onClick={() => loadFileDiff(path)}
                                                title={`Review ${path}`}
                                            >
                                                <code>{path}</code>
                                                <span>Open diff →</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            ))}
                        </div>
                        {selectedFile && (
                            <section className="review-editor-panel">
                                <div className="review-editor-heading">
                                    <div>
                                        <span className="review-editor-eyebrow">CODE REVIEW</span>
                                        <h3>{selectedFile}</h3>
                                        <p>
                                            {shortId(base?.commit_id)} → {shortId(target?.commit_id)}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedFile("");
                                            setFileDiff(null);
                                            setFileDiffError("");
                                        }}
                                    >
                                        Close
                                    </button>
                                </div>

                                {fileDiffLoading && (
                                    <p className="review-editor-message">Loading file comparison...</p>
                                )}

                                {fileDiffError && (
                                    <p className="review-editor-error">{fileDiffError}</p>
                                )}

                                {fileDiff && (
                                    <>
                                        <div className="review-editor-legend">
                                            <span className="review-added">+ New version</span>
                                            <span className="review-deleted">− Previous version</span>
                                            <span>{reviewLanguage(selectedFile)}</span>
                                        </div>
                                        <DiffEditor
                                            height="520px"
                                            language={reviewLanguage(selectedFile)}
                                            theme="vs-dark"
                                            original={fileDiff.old_content ?? ""}
                                            modified={fileDiff.new_content ?? ""}
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
                                                diffAlgorithm: "advanced",
                                                ignoreTrimWhitespace: false,
                                                fontSize: 13,
                                                padding: { top: 12, bottom: 12 }
                                            }}
                                        />
                                    </>
                                )}
                            </section>
                        )}                    </>
                )}
            </div>
        </section>
    );
}
