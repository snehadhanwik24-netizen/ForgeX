import { useCallback, useEffect, useState } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import {
    fetchBranches,
    createBranch,
    switchBranch,
    mergeRepositoryBranch,
    fetchConflictDetails,
    resolveRepositoryConflicts
} from "../services/commitApi";

function BranchManager({ repositoryId, onBranchChanged }) {
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(() => {
        return localStorage.getItem(`forgex-active-branch-${repositoryId}`) || "main";
    });
    const [newBranch, setNewBranch] = useState("");
    const [activeBranch, setActiveBranch] = useState("main");
    const [mergeSource, setMergeSource] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [conflictDetails, setConflictDetails] = useState(null);
    const [selectedConflictPath, setSelectedConflictPath] = useState("");
    const [resolvedContents, setResolvedContents] = useState({});
    const [resolutionMessage, setResolutionMessage] = useState("");
    useEffect(() => {
        if (selectedBranch) {
            localStorage.setItem(
                `forgex-active-branch-${repositoryId}`,
                selectedBranch
            );
        }
    }, [repositoryId, selectedBranch]);

    const loadBranches = useCallback(async () => {
        try {
            const data = await fetchBranches(repositoryId);
            const raw = data.branches;

            const names = Array.isArray(raw)
                ? raw.map(branch =>
                    typeof branch === "string" ? branch : branch.name
                ).filter(Boolean)
                : Object.keys(raw || {});

            setBranches(names);

            if (Array.isArray(raw)) {
                const current = raw.find(branch =>
                    typeof branch === "object" && branch.current
                );
                if (current?.name) setActiveBranch(current.name);
            }

            if (names.length && !names.includes(selectedBranch)) {
                setSelectedBranch(names.includes("main") ? "main" : names[0]);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [repositoryId, selectedBranch]);

    useEffect(() => {
        let active = true;

        const initializeBranches = async () => {
            try {
                const data = await fetchBranches(repositoryId);
                if (!active) return;

                const raw = data.branches;
                const names = Array.isArray(raw)
                    ? raw.map(branch =>
                        typeof branch === "string" ? branch : branch.name
                    ).filter(Boolean)
                    : Object.keys(raw || {});

                setBranches(names);

                if (Array.isArray(raw)) {
                    const currentBranch = raw.find(branch =>
                        typeof branch === "object" && branch.current
                    );
                    if (currentBranch?.name) {
                        setActiveBranch(currentBranch.name);
                    }
                }

                setSelectedBranch(current =>
                    names.includes(current)
                        ? current
                        : names.includes("main")
                            ? "main"
                            : names[0] || "main"
                );
            } catch (err) {
                if (active) setError(err.message);
            }
        };

        initializeBranches();


    return () => {
            active = false;
        };
    }, [repositoryId]);

    const handleCreate = async (event) => {
        event.preventDefault();

        if (!newBranch.trim()) return;

        try {
            setError("");
            setMessage("");

            await createBranch(repositoryId, newBranch.trim());
            setMessage(`Branch "${newBranch.trim()}" created.`);
            setSelectedBranch(newBranch.trim());
            setNewBranch("");

            await loadBranches();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSwitch = async () => {
        try {
            setLoading(true);
            setError("");
            setMessage("");

            const result = await switchBranch(
                repositoryId,
                selectedBranch
            );

            setActiveBranch(selectedBranch);
            setMergeSource("");
            setMessage(result.message || `Switched to ${selectedBranch}.`);

            if (onBranchChanged) {
                await onBranchChanged(result);
            }
        } catch (err) {
            const details = err.dirtyFiles?.length
                ? ` Uncommitted files: ${err.dirtyFiles.join(", ")}`
                : "";

            setError(err.message + details);
        } finally {
            setLoading(false);
        }
    };

    const handleMerge = async () => {
        if (!mergeSource || mergeSource === activeBranch) return;

        const confirmed = window.confirm(
            `Merge "${mergeSource}" into "${activeBranch}"?`
        );

        if (!confirmed) return;

        try {
            setLoading(true);
            setError("");
            setMessage("");

            const result = await mergeRepositoryBranch(
                repositoryId,
                mergeSource,
                `Merge ${mergeSource} into ${activeBranch}`
            );

            setMessage(result.message || "Merge completed successfully.");
            setMergeSource("");

            await loadBranches();

            if (onBranchChanged) {
                await onBranchChanged(result);
            }
        } catch (err) {
            const dirty = err.dirtyFiles?.length
                ? ` Uncommitted files: ${err.dirtyFiles.join(", ")}`
                : "";

            if (err.conflicts?.length) {
                try {
                    const details = await fetchConflictDetails(
                        repositoryId,
                        mergeSource
                    );

                    setConflictDetails(details);
                    setSelectedConflictPath(details.conflicts[0]?.path || "");
                    setResolvedContents(
                        Object.fromEntries(
                            details.conflicts.map(item => [
                                item.path,
                                item.target_content ?? ""
                            ])
                        )
                    );
                    setResolutionMessage(
                        `Merge conflict detected in ${err.conflicts.length} file(s). Resolve each file below.`
                    );
                    setError("");
                } catch (detailError) {
                    setError(detailError.message);
                }
            } else {
                setError(err.message + dirty);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async () => {
        if (!conflictDetails) return;

        const resolvedFiles = {};

        for (const conflict of conflictDetails.conflicts) {
            const content = resolvedContents[conflict.path];

            if (typeof content !== "string") {
                setError(`Missing resolved content for ${conflict.path}`);
                return;
            }

            resolvedFiles[conflict.path] = content;
        }

        try {
            setLoading(true);
            setError("");

            const result = await resolveRepositoryConflicts(
                repositoryId,
                conflictDetails.source_branch,
                resolvedFiles,
                resolutionMessage || `Merge ${conflictDetails.source_branch} into ${conflictDetails.target_branch}`
            );

            setMessage(result.message);
            setConflictDetails(null);
            setSelectedConflictPath("");
            setResolvedContents({});

            await loadBranches();

            if (onBranchChanged) {
                await onBranchChanged(result);
            }
        } catch (err) {
            setError(err.message + (err.details ? `: ${err.details}` : ""));
        } finally {
            setLoading(false);
        }
    };

    return (
        <section style={{
            background: "#151c27",
            border: "1px solid #303b4b",
            borderRadius: "12px",
            padding: "24px",
            color: "#e7edf7",
            marginBottom: "24px"
        }}>
            <h3 style={{ marginTop: 0 }}>Branch Management</h3>

            <p style={{ color: "#aab8ca" }}>
                Create branches and switch between committed versions.
            </p>

            <div style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom: "16px"
            }}>
                <select
                    value={selectedBranch}
                    onChange={event => setSelectedBranch(event.target.value)}
                    disabled={loading || branches.length === 0}
                    style={{ padding: "10px", minWidth: "180px", background: "#0d1420", color: "#e7edf7", border: "1px solid #39475a", borderRadius: "6px" }}
                >
                    {branches.map(branch => (
                        <option key={branch} value={branch}>
                            {branch}
                        </option>
                    ))}
                </select>

                <button
                    onClick={handleSwitch}
                    disabled={loading || !branches.includes(selectedBranch)}
                >
                    Switch Branch
                </button>

                <button onClick={loadBranches} disabled={loading}>
                    Refresh
                </button>
            </div>

            <div style={{
                borderTop: "1px solid #303b4b",
                paddingTop: "18px",
                marginTop: "18px",
                marginBottom: "18px"
            }}>
                <h4>Merge into active branch</h4>

                <p style={{ color: "#aab8ca" }}>
                    Active target: <strong>{activeBranch}</strong>
                </p>

                <div style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap"
                }}>
                    <select
                        value={mergeSource}
                        onChange={event => setMergeSource(event.target.value)}
                        disabled={loading}
                        style={{
                            padding: "10px",
                            minWidth: "180px",
                            background: "#0d1420",
                            color: "#e7edf7",
                            border: "1px solid #39475a",
                            borderRadius: "6px"
                        }}
                    >
                        <option value="">Select source branch</option>
                        {branches.filter(branch => branch !== activeBranch).map(branch => (
                            <option key={branch} value={branch}>
                                {branch}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={handleMerge}
                        disabled={
                            loading ||
                            !mergeSource ||
                            !activeBranch ||
                            mergeSource === activeBranch
                        }
                    >
                        Merge Branch
                    </button>
                </div>
            </div>


            {conflictDetails && (
                <div style={{
                    border: "1px solid #d69e36",
                    borderRadius: "10px",
                    padding: "18px",
                    marginBottom: "20px",
                    background: "#101925"
                }}>
                    <h3>Conflict Resolution Editor</h3>

                    <p style={{ color: "#aab8ca" }}>
                        Compare the target and source versions, then edit
                        the final resolved content.
                    </p>

                    <label>Conflicting file</label>
                    <select
                        value={selectedConflictPath}
                        onChange={event => setSelectedConflictPath(event.target.value)}
                        style={{
                            display: "block",
                            width: "100%",
                            padding: "10px",
                            margin: "10px 0",
                            background: "#0d1420",
                            color: "#e7edf7",
                            border: "1px solid #39475a",
                            borderRadius: "6px"
                        }}
                    >
                        {conflictDetails.conflicts.map(item => (
                            <option key={item.path} value={item.path}>
                                {item.path}
                            </option>
                        ))}
                    </select>

                    {(() => {
                        const conflict = conflictDetails.conflicts.find(
                            item => item.path === selectedConflictPath
                        );

                        if (!conflict) return null;

                        return (
                            <>
                                <h4>Target vs Source</h4>
                                <DiffEditor
                                    height="260px"
                                    language={
                                        selectedConflictPath.endsWith(".py")
                                            ? "python"
                                            : selectedConflictPath.endsWith(".json")
                                                ? "json"
                                                : selectedConflictPath.endsWith(".md")
                                                    ? "markdown"
                                                    : "plaintext"
                                    }
                                    original={conflict.target_content ?? ""}
                                    modified={conflict.source_content ?? ""}
                                    theme="vs-dark"
                                    options={{
                                        readOnly: true,
                                        renderSideBySide: true,
                                        minimap: { enabled: false },
                                        automaticLayout: true
                                    }}
                                />

                                <h4>Resolved version</h4>
                                <Editor
                                    height="280px"
                                    language={
                                        selectedConflictPath.endsWith(".py")
                                            ? "python"
                                            : selectedConflictPath.endsWith(".json")
                                                ? "json"
                                                : selectedConflictPath.endsWith(".md")
                                                    ? "markdown"
                                                    : "plaintext"
                                    }
                                    theme="vs-dark"
                                    value={resolvedContents[selectedConflictPath] ?? ""}
                                    onChange={value => setResolvedContents(previous => ({
                                        ...previous,
                                        [selectedConflictPath]: value ?? ""
                                    }))}
                                    options={{
                                        minimap: { enabled: false },
                                        automaticLayout: true,
                                        fontSize: 14
                                    }}
                                />
                            </>
                        );
                    })()}

                    <label style={{ display: "block", marginTop: "16px" }}>
                        Merge commit message
                    </label>

                    <input
                        value={resolutionMessage}
                        onChange={event => setResolutionMessage(event.target.value)}
                        placeholder="Resolve merge conflicts"
                        style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "10px",
                            marginTop: "8px",
                            background: "#0d1420",
                            color: "#e7edf7",
                            border: "1px solid #39475a",
                            borderRadius: "6px"
                        }}
                    />

                    <button
                        type="button"
                        onClick={handleResolve}
                        disabled={loading}
                        style={{
                            marginTop: "16px",
                            padding: "11px 18px",
                            background: "#238636",
                            color: "white",
                            border: 0,
                            borderRadius: "6px",
                            cursor: "pointer"
                        }}
                    >
                        {loading ? "Resolving..." : "Complete Merge"}
                    </button>
                </div>
            )}

            <form
                onSubmit={handleCreate}
                style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap"
                }}
            >
                <input
                    value={newBranch}
                    onChange={event => setNewBranch(event.target.value)}
                    placeholder="New branch name"
                    maxLength={100}
                    style={{ padding: "10px", minWidth: "180px", background: "#0d1420", color: "#e7edf7", border: "1px solid #39475a", borderRadius: "6px" }}
                />

                <button type="submit" disabled={loading || !newBranch.trim()}>
                    Create Branch
                </button>
            </form>

            {message && (
                <p role="status" style={{ color: "green" }}>{message}</p>
            )}

            {error && (
                <p role="alert" style={{ color: "crimson" }}>{error}</p>
            )}
        </section>
    );
}

export default BranchManager;
