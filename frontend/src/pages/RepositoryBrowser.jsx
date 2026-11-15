import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import {
    fetchRepositoryFiles,
    createRepositoryFile,
    updateRepositoryFile,
    deleteRepositoryFile
} from "../services/repositoryFileApi";
import { fetchFileVersions, restoreFileVersion } from "../services/versionApi";
import "../RepositoryBrowser.css";
import {
    fetchWorkingTreeStatus,
    fetchStagingStatus,
    stageRepositoryFile,
    stageRepositoryDeletion,
    unstageRepositoryFile,
    unstageRepositoryDeletion,
    createCommit
} from "../services/commitApi";

async function buildRepositoryTree(repositoryId, folderPath = "") {
    const data = await fetchRepositoryFiles(repositoryId, folderPath);

    return Promise.all(
        (data.files || []).map(async (file) => {
            if (file.type === "folder") {
                const children = await buildRepositoryTree(
                    repositoryId,
                    file.path
                );

                return { ...file, children };
            }

            return { ...file, children: [] };
        })
    );
}

function RepositoryBrowser({ repository, onBack }) {
    const [tree, setTree] = useState([]);
    const [expandedPaths, setExpandedPaths] = useState(new Set());
    const [currentPath, setCurrentPath] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [content, setContent] = useState("");
    const [editing, setEditing] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [fileType, setFileType] = useState("file");
    const [fileName, setFileName] = useState("");
    const [loading, setLoading] = useState(true);
    const [workingStatus, setWorkingStatus] = useState(null);
    const [statusLoading, setStatusLoading] = useState(false);
    const [statusError, setStatusError] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [showHistory, setShowHistory] = useState(false);
    const [versions, setVersions] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [stagingStatus, setStagingStatus] = useState(null);
    const [stagingLoading, setStagingLoading] = useState(false);
    const [stagingError, setStagingError] = useState("");
    const [commitMessage, setCommitMessage] = useState("");
    const [commitLoading, setCommitLoading] = useState(false);

    // Load working tree changes
    const loadWorkingStatus = useCallback(async () => {
        try {
            setStatusLoading(true);
            setStatusError("");

            const result = await fetchWorkingTreeStatus(repository._id);
            setWorkingStatus(result);
        } catch (error) {
            setStatusError(error.message || "Unable to load changes");
        } finally {
            setStatusLoading(false);
        }
    }, [repository._id]);

    // Load staging area
    const loadStagingStatus = useCallback(async () => {
        try {
            setStagingLoading(true);
            setStagingError("");

            const result = await fetchStagingStatus(repository._id);
            setStagingStatus(result);
        } catch (err) {
            setStagingError(err.message || "Unable to load staging area");
        } finally {
            setStagingLoading(false);
        }
    }, [repository._id]);

    // Find a file document by its repository path
    const findFileByPath = (items, targetPath) => {
        for (const item of items) {
            if (item.path === targetPath && item.type === "file") {
                return item;
            }

            if (item.children?.length) {
                const found = findFileByPath(item.children, targetPath);
                if (found) return found;
            }
        }

        return null;
    };

    const handleStageFile = async (filePath) => {
        try {
            const file = findFileByPath(tree, filePath);

            if (!file?._id) {
                throw new Error("Could not find the file record to stage");
            }

            await stageRepositoryFile(repository._id, file._id);
            await loadTree();
            await loadStagingStatus();
            setMessage(`Staged ${filePath}`);
        } catch (err) {
            setStagingError(err.message);
        }
    };

    const handleStageDeletion = async (filePath) => {
        try {
            await stageRepositoryDeletion(repository._id, filePath);
            await loadTree();
            await loadStagingStatus();
            setMessage(`Staged deletion of ${filePath}`);
        } catch (err) {
            setStagingError(err.message);
        }
    };

    const handleUnstageFile = async (filePath) => {
        try {
            await unstageRepositoryFile(repository._id, filePath);
            await loadStagingStatus();
            setMessage(`Unstaged ${filePath}`);
        } catch (err) {
            setStagingError(err.message);
        }
    };

    const handleUnstageDeletion = async (filePath) => {
        try {
            await unstageRepositoryDeletion(repository._id, filePath);
            await loadStagingStatus();
            setMessage(`Unstaged deletion of ${filePath}`);
        } catch (err) {
            setStagingError(err.message);
        }
    };

    const handleCreateCommit = async () => {
        if (!commitMessage.trim()) {
            setStagingError("Enter a commit message");
            return;
        }

        if (!stagingStatus?.summary?.total) {
            setStagingError("Stage at least one change before committing");
            return;
        }

        try {
            setCommitLoading(true);
            setStagingError("");

            await createCommit(repository._id, commitMessage.trim());

            setCommitMessage("");
            setMessage("Commit created successfully");

            await loadTree();
            await loadStagingStatus();
        } catch (err) {
            setStagingError(err.message || "Commit failed");
        } finally {
            setCommitLoading(false);
        }
    };
    // Load repository files and refresh working tree status
    const loadTree = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const result = await buildRepositoryTree(repository._id);
            setTree(result);
            await loadWorkingStatus();
            await loadStagingStatus();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [repository._id, loadWorkingStatus, loadStagingStatus]);

    useEffect(() => {
        let isCurrent = true;

        buildRepositoryTree(repository._id)
            .then(async (result) => {
                if (!isCurrent) return;

                setTree(result);

                const status = await fetchWorkingTreeStatus(repository._id);

                if (isCurrent) {
                    setWorkingStatus(status);
                    const staging = await fetchStagingStatus(repository._id);
                    if (isCurrent) {
                        setStagingStatus(staging);
                        setStagingError("");
                    }
                    setStatusError("");
                }
            })
            .catch((err) => {
                if (isCurrent) {
                    setError(err.message);
                    setStatusError(err.message);
                }
            })
            .finally(() => {
                if (isCurrent) {
                    setLoading(false);
                    setStatusLoading(false);
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [repository._id]);
    // Expand or collapse a folder
    const toggleFolder = (folder) => {
        setExpandedPaths(previous => {
            const updated = new Set(previous);

            if (updated.has(folder.path)) {
                updated.delete(folder.path);
            } else {
                updated.add(folder.path);
            }

            return updated;
        });

        setCurrentPath(folder.path);
        setSelectedFile(null);
        setContent("");
        setEditing(false);
        setMessage("");
    };

    // Open a file in the editor
    const openFile = (file) => {
        setSelectedFile(file);
        setContent(file.content || "");
        setEditing(false);
        setMessage("");
    };

    // Create a file or folder in the selected folder
    const handleCreate = async (event) => {
        event.preventDefault();

        try {
            setError("");
            setMessage("");

            const name = fileName.trim();

            if (!name || name.includes("/") || name.includes("\\")) {
                throw new Error("Enter a valid file or folder name.");
            }

            const fullPath = currentPath
                ? `${currentPath}/${name}`
                : name;

            const result = await createRepositoryFile(
                repository._id,
                {
                    name,
                    path: fullPath,
                    type: fileType,
                    content: ""
                }
            );

            setMessage(result.message);
            setFileName("");
            setShowForm(false);

            await loadTree();

            if (fileType === "folder") {
                setExpandedPaths(previous =>
                    new Set([...previous, currentPath, fullPath])
                );
            }
        } catch (err) {
            setError(err.message);
        }
    };

    // Save edited file
    const handleSave = async () => {
        try {
            setError("");

            const result = await updateRepositoryFile(
                repository._id,
                selectedFile._id,
                content
            );

            setSelectedFile(result.file);
            setContent(result.file.content);
            setEditing(false);
            setMessage("File saved successfully!");

            await loadTree();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSaveRef = useRef(handleSave);

    useEffect(() => {
        handleSaveRef.current = handleSave;
    });

    // Load file version history
    const handleShowHistory = async () => {
        try {
            setHistoryLoading(true);
            setError("");
            setShowHistory(true);
            setSelectedVersion(null);

            const data = await fetchFileVersions(
                repository._id,
                selectedFile._id
            );

            setVersions(data.versions || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Restore a previous file version
    const handleRestoreVersion = async (versionNumber) => {
        if (!window.confirm(`Restore version ${versionNumber}?`)) return;

        try {
            setError("");

            const result = await restoreFileVersion(
                repository._id,
                selectedFile._id,
                versionNumber
            );

            setSelectedFile(result.file);
            setContent(result.file.content);
            setEditing(false);
            setSelectedVersion(null);
            setMessage("Previous version restored successfully!");

            await loadTree();
            await handleShowHistory();
        } catch (err) {
            setError(err.message);
        }
    };

    // Delete a file or empty folder
    const handleDelete = async (file) => {
        if (!window.confirm(`Delete ${file.name}?`)) return;

        try {
            setError("");
            setMessage("");

            await deleteRepositoryFile(
                repository._id,
                file._id
            );

            if (selectedFile?._id === file._id) {
                setSelectedFile(null);
                setContent("");
                setEditing(false);
            }

            if (file.type === "folder") {
                setExpandedPaths(previous => {
                    const updated = new Set(previous);
                    updated.delete(file.path);
                    return updated;
                });
            }

            setMessage("Deleted successfully!");
            await loadTree();
        } catch (err) {
            setError(err.message);
        }
    };

    const hasUnsavedChanges =
        selectedFile && content !== (selectedFile.content || "");
    // Save changes using Ctrl+S
    useEffect(() => {
        const handleKeyboardSave = (event) => {
            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "s" &&
                selectedFile &&
                editing &&
                hasUnsavedChanges
            ) {
                event.preventDefault();
                handleSaveRef.current();
            }
        };

        window.addEventListener("keydown", handleKeyboardSave);

        return () => {
            window.removeEventListener("keydown", handleKeyboardSave);
        };
    }, [selectedFile, editing, hasUnsavedChanges]);

    // Navigate through breadcrumbs
    const navigateToFolder = (path) => {
        setCurrentPath(path);
        setSelectedFile(null);
        setContent("");
        setEditing(false);

        if (path) {
            const parts = path.split("/");
            const updated = new Set();

            parts.forEach((part, index) => {
                updated.add(parts.slice(0, index + 1).join("/"));
            });

            setExpandedPaths(updated);
        } else {
            setExpandedPaths(new Set());
        }
    };

    // Render files and nested folders recursively
    const renderTree = (nodes, depth = 0) => {
        return nodes.map(node => {
            const isFolder = node.type === "folder";
            const isExpanded = expandedPaths.has(node.path);
            const isSelected = selectedFile?._id === node._id;

            const extension = node.name.includes(".")
                ? node.name.split(".").pop().toLowerCase()
                : "";

            const fileIcon = {
                js: "🟨",
                jsx: "⚛️",
                ts: "🔷",
                tsx: "⚛️",
                json: "📋",
                md: "📝",
                css: "🎨",
                html: "🌐",
                py: "🐍"
            }[extension] || "📄";

            return (
                <div key={node._id}>
                    <div
                        className={
                            isSelected
                                ? "repo-tree-row selected"
                                : "repo-tree-row"
                        }
                        style={{ paddingLeft: `${12 + depth * 19}px` }}
                    >
                        <button
                            className="repo-tree-open"
                            onClick={() => {
                                if (isFolder) {
                                    toggleFolder(node);
                                } else {
                                    openFile(node);
                                }
                            }}
                        >
                            <span className="tree-arrow">
                                {isFolder
                                    ? (isExpanded ? "▼" : "▶")
                                    : ""}
                            </span>

                            <span className="tree-icon">
                                {isFolder
                                    ? (isExpanded ? "📂" : "📁")
                                    : fileIcon}
                            </span>

                            <span className="tree-name">{node.name}</span>
                        </button>

                        <button
                            className="repo-tree-delete"
                            title="Delete"
                            onClick={() => handleDelete(node)}
                        >
                            🗑️
                        </button>
                    </div>

                    {isFolder && isExpanded && (
                        <div className="repo-tree-children">
                            {node.children.length > 0
                                ? renderTree(node.children, depth + 1)
                                : (
                                    <p
                                        className="tree-empty"
                                        style={{
                                            paddingLeft: `${35 + (depth + 1) * 19}px`
                                        }}
                                    >
                                        Empty folder
                                    </p>
                                )
                            }
                        </div>
                    )}
                </div>
            );
        });
    };

    const extension = selectedFile?.name.split(".").pop().toLowerCase();

    const editorLanguage = {
        js: "javascript",
        jsx: "javascript",
        ts: "typescript",
        tsx: "typescript",
        py: "python",
        json: "json",
        html: "html",
        css: "css",
        md: "markdown",
        java: "java",
        c: "c",
        cpp: "cpp"
    }[extension] || "plaintext";


    const pathParts = currentPath ? currentPath.split("/") : [];

    return (
        <div className="repo-browser">
            <div className="repo-browser-header">
                <div>
                    <button
                        className="repo-back-button"
                        onClick={() => {
                            if (currentPath) {
                                const parts = currentPath.split("/");
                                parts.pop();
                                navigateToFolder(parts.join("/"));
                            } else {
                                onBack();
                            }
                        }}
                    >
                        ← {currentPath ? "Parent Folder" : "Back to Repositories"}
                    </button>

                    <h1>📁 {repository.name}</h1>

                    <section style={{
                        background: "#151c27",
                        border: "1px solid #303b4b",
                        borderRadius: "12px",
                        padding: "18px",
                        marginBottom: "20px",
                        color: "#e7edf7"
                    }}>
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "12px"
                        }}>
                            <div>
                                <h3 style={{ margin: 0 }}>Working Tree Changes</h3>
                                <p style={{ color: "#aab8ca" }}>
                                    Current branch: {workingStatus?.branch || "Loading"}
                                </p>
                            </div>

                            <button
                                onClick={loadWorkingStatus}
                                disabled={statusLoading}
                            >
                                {statusLoading ? "Refreshing..." : "Refresh Changes"}
                            </button>
                        </div>

                        {statusError && (
                            <p role="alert" style={{ color: "#ff8585" }}>
                                {statusError}
                            </p>
                        )}

                        {workingStatus && (
                            <>
                                <div style={{
                                    display: "flex",
                                    gap: "12px",
                                    flexWrap: "wrap",
                                    margin: "16px 0"
                                }}>
                                    <span>Added: {workingStatus.summary.added}</span>
                                    <span>Modified: {workingStatus.summary.modified}</span>
                                    <span>Deleted: {workingStatus.summary.deleted}</span>
                                    <strong>
                                        {workingStatus.clean ? "Clean working tree" : "Uncommitted changes"}
                                    </strong>
                                </div>

                                {[
                                    ["Added", workingStatus.changes.added],
                                    ["Modified", workingStatus.changes.modified],
                                    ["Deleted", workingStatus.changes.deleted]
                                ].map(([label, files]) => (
                                    files.length > 0 && (
                                        <div key={label} style={{ marginTop: "12px" }}>
                                            <strong>{label}</strong>
                                            {files.map(file => (
                                                <div key={file.path} style={{
                                                    padding: "7px 10px",
                                                    marginTop: "5px",
                                                    background: "#0d1420",
                                                    borderRadius: "5px"
                                                }}>
                                                    {file.path}
                                                </div>
                                            ))}
                                        </div>
                                    )
                                ))}
                            </>
                        )}
                    </section>

                    <section style={{
                        background: "#151c27",
                        border: "1px solid #303b4b",
                        borderRadius: "12px",
                        padding: "18px",
                        marginBottom: "20px",
                        color: "#e7edf7"
                    }}>
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "12px"
                        }}>
                            <h3 style={{ margin: 0 }}>Source Control</h3>
                            <span style={{ color: "#aab8ca" }}>
                                {stagingStatus?.summary?.total || 0} staged change(s)
                            </span>
                        </div>

                        {stagingError && (
                            <p role="alert" style={{ color: "#ff8585" }}>
                                {stagingError}
                            </p>
                        )}

                        {stagingLoading && (
                            <p style={{ color: "#aab8ca" }}>Loading staging area...</p>
                        )}

                        <h4>Changes</h4>

                        {workingStatus && [
                            ...workingStatus.changes.added,
                            ...workingStatus.changes.modified
                        ].map(file => {
                            const isStaged = Object.prototype.hasOwnProperty.call(
                                stagingStatus?.staged_files || {},
                                file.path
                            );

                            return (
                                <div key={file.path} style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "10px",
                                    padding: "8px",
                                    marginBottom: "6px",
                                    background: "#0d1420",
                                    borderRadius: "6px"
                                }}>
                                    <span style={{ overflowWrap: "anywhere" }}>
                                        {file.path}
                                    </span>
                                    <button
                                        disabled={stagingLoading}
                                        onClick={() => handleStageFile(file.path)}
                                    >
                                        {isStaged ? "Stage Again" : "Stage"}
                                    </button>
                                </div>
                            );
                        })}

                        {workingStatus?.changes.deleted?.map(file => {
                            const isStaged = (
                                stagingStatus?.deleted_files || []
                            ).includes(file.path);

                            return (
                                <div key={file.path} style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "10px",
                                    padding: "8px",
                                    marginBottom: "6px",
                                    background: "#0d1420",
                                    borderRadius: "6px"
                                }}>
                                    <span style={{ overflowWrap: "anywhere" }}>
                                        {file.path} (deleted)
                                    </span>
                                    <button
                                        disabled={stagingLoading || isStaged}
                                        onClick={() => handleStageDeletion(file.path)}
                                    >
                                        {isStaged ? "Deletion Staged" : "Stage Deletion"}
                                    </button>
                                </div>
                            );
                        })}

                        <h4>Staged Files</h4>

                        {Object.keys(stagingStatus?.staged_files || {}).length === 0 &&
                         (stagingStatus?.deleted_files || []).length === 0 && (
                            <p style={{ color: "#aab8ca" }}>
                                No files staged yet.
                            </p>
                        )}

                        {Object.entries(stagingStatus?.staged_files || {}).map(
                            ([filePath]) => (
                                <div key={filePath} style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "10px",
                                    padding: "8px",
                                    marginBottom: "6px",
                                    background: "#0d1420",
                                    borderRadius: "6px"
                                }}>
                                    <span style={{ overflowWrap: "anywhere" }}>
                                        {filePath}
                                    </span>
                                    <button
                                        disabled={stagingLoading}
                                        onClick={() => handleUnstageFile(filePath)}
                                    >
                                        Unstage
                                    </button>
                                </div>
                            )
                        )}

                        {(stagingStatus?.deleted_files || []).map(filePath => (
                            <div key={filePath} style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "10px",
                                padding: "8px",
                                marginBottom: "6px",
                                background: "#0d1420",
                                borderRadius: "6px"
                            }}>
                                <span style={{ overflowWrap: "anywhere" }}>
                                    {filePath} (deletion)
                                </span>
                                <button
                                    disabled={stagingLoading}
                                    onClick={() => handleUnstageDeletion(filePath)}
                                >
                                    Unstage
                                </button>
                            </div>
                        ))}

                        <div style={{
                            borderTop: "1px solid #303b4b",
                            marginTop: "18px",
                            paddingTop: "16px"
                        }}>
                            <h4>Commit Changes</h4>
                            <textarea
                                value={commitMessage}
                                onChange={(event) => setCommitMessage(event.target.value)}
                                placeholder="Enter a commit message..."
                                rows={3}
                                style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    padding: "10px",
                                    borderRadius: "6px",
                                    background: "#0d1420",
                                    color: "#e7edf7",
                                    border: "1px solid #303b4b",
                                    resize: "vertical"
                                }}
                            />
                            <button
                                onClick={handleCreateCommit}
                                disabled={
                                    commitLoading ||
                                    !stagingStatus?.summary?.total ||
                                    !commitMessage.trim()
                                }
                                style={{ marginTop: "10px" }}
                            >
                                {commitLoading ? "Committing..." : "Commit Changes"}
                            </button>
                        </div>
                    </section>

                    <p>
                        {repository.description || "No repository description"}
                    </p>
                </div>

                <button
                    className="repo-new-file-button"
                    onClick={() => setShowForm(!showForm)}
                >
                    + New File / Folder
                </button>
            </div>

            <div className="repo-breadcrumbs">
                <button onClick={() => navigateToFolder("")}>
                    🏠 Root
                </button>

                {pathParts.map((part, index) => {
                    const path = pathParts.slice(0, index + 1).join("/");

                    return (
                        <span key={path}>
                            <span className="breadcrumb-separator"> / </span>
                            <button onClick={() => navigateToFolder(path)}>
                                {part}
                            </button>
                        </span>
                    );
                })}
            </div>

            {error && (
                <div className="browser-message error">{error}</div>
            )}

            {message && (
                <div className="browser-message success">{message}</div>
            )}

            {showForm && (
                <form
                    className="browser-create-form"
                    onSubmit={handleCreate}
                >
                    <h3>
                        Create inside {currentPath || "repository root"}
                    </h3>

                    <input
                        value={fileName}
                        onChange={event => setFileName(event.target.value)}
                        placeholder="Enter file or folder name"
                        required
                    />

                    <select
                        value={fileType}
                        onChange={event => setFileType(event.target.value)}
                    >
                        <option value="file">📄 File</option>
                        <option value="folder">📁 Folder</option>
                    </select>

                    <button type="submit">Create</button>

                    <button
                        type="button"
                        className="browser-cancel-button"
                        onClick={() => setShowForm(false)}
                    >
                        Cancel
                    </button>
                </form>
            )}

            <div className="repo-browser-layout">
                <section className="repo-file-panel">
                    <div className="repo-panel-title">
                        <h3>📂 Explorer</h3>
                        <span>{tree.length} root items</span>
                    </div>

                    {loading ? (
                        <p className="browser-empty">Loading explorer...</p>
                    ) : tree.length === 0 ? (
                        <p className="browser-empty">
                            No files yet. Create your first file!
                        </p>
                    ) : (
                        <div className="repo-tree">
                            {renderTree(tree)}
                        </div>
                    )}
                </section>

                <section className="repo-editor-panel">
                    {!selectedFile ? (
                        <div className="browser-empty editor-empty">
                            <span>📄</span>
                            <h3>Select a file</h3>
                            <p>
                                Expand folders and select a file to view its contents.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="repo-editor-header">
                                <div>
                                    <h3>📄 {selectedFile.name}</h3>
                                    <small>{selectedFile.path}</small>
{hasUnsavedChanges && <small className="unsaved-indicator">● Unsaved changes</small>}
                                </div>

                                {!editing ? (
                                    <button onClick={() => setEditing(true)}>
                                        ✏️ Edit
                                    </button>
                                ) : (
                                    <button onClick={handleSave}>
                                        💾 Save
                                    </button>
                                )}

                                <button
                                    className="version-history-button"
                                    onClick={handleShowHistory}
                                >
                                    🕘 History
                                </button>
                            </div>

                            <Editor
                                height="380px"
                                language={editorLanguage}
                                theme="vs-dark"
                                value={content}
                                onChange={(value) => setContent(value ?? "")}
                                options={{
                                    readOnly: !editing,
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    lineNumbers: "on",
                                    roundedSelection: true,
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    tabSize: 4,
                                    wordWrap: "on",
                                    padding: { top: 15 }
                                }}
                            />

                            <p className="editor-status">
                                {editing ? "Editing file..." : "Read-only mode"}
                            </p>

                            {showHistory && (
                                <div className="version-history-panel">
                                    <div className="version-history-header">
                                        <h3>🕘 Version History</h3>
                                        <button onClick={() => {
                                            setShowHistory(false);
                                            setSelectedVersion(null);
                                        }}>
                                            Close
                                        </button>
                                    </div>

                                    {historyLoading ? (
                                        <p>Loading versions...</p>
                                    ) : versions.length === 0 ? (
                                        <p>No previous versions available.</p>
                                    ) : (
                                        <div className="version-history-list">
                                            {versions.slice().reverse().map(version => (
                                                <div
                                                    className="version-history-item"
                                                    key={version._id || version.versionNumber}
                                                >
                                                    <div>
                                                        <strong>Version {version.versionNumber}</strong>
                                                        <small>
                                                            {new Date(version.createdAt).toLocaleString()}
                                                        </small>
                                                    </div>

                                                    <button onClick={() => setSelectedVersion(version)}>
                                                        Preview
                                                    </button>

                                                    <button onClick={() => handleRestoreVersion(version.versionNumber)}>
                                                        Restore
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {selectedVersion && (
                                        <div className="version-preview">
                                            <h4>Preview: Version {selectedVersion.versionNumber}</h4>
                                            <pre>{selectedVersion.content}</pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}

export default RepositoryBrowser;


















