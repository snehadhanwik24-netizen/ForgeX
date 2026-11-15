import { useCallback, useEffect, useState } from "react";
import {
    fetchBranches,
    createBranch,
    switchBranch
} from "../services/commitApi";

function BranchManager({ repositoryId, onBranchChanged }) {
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(() => {
        return localStorage.getItem(`forgex-active-branch-${repositoryId}`) || "main";
    });
    const [newBranch, setNewBranch] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
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





