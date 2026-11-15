import { useEffect, useState } from "react";
import { fetchDashboardRepositories } from "../services/dashboardApi";
import BranchManager from "../components/BranchManager";

function Branches() {
    const [repositories, setRepositories] = useState([]);
    const [selectedRepository, setSelectedRepository] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let active = true;

        const loadRepositories = async () => {
            try {
                setLoading(true);
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
                if (active) setError(err.message);
            } finally {
                if (active) setLoading(false);
            }
        };

        loadRepositories();

        return () => {
            active = false;
        };
    }, []);

    const handleBranchChanged = () => {
        setRefreshKey(value => value + 1);
    };

    return (
        <div className="branches-page">
            <div style={{ marginBottom: "24px" }}>
                <p className="eyebrow">VERSION CONTROL</p>
                <h1>Branch Management</h1>
                <p>Manage independent development lines across your repositories.</p>
            </div>

            {loading ? (
                <div className="panel">Loading your repositories...</div>
            ) : error ? (
                <div className="panel" role="alert" style={{ color: "crimson" }}>
                    {error}
                </div>
            ) : repositories.length === 0 ? (
                <div className="panel">
                    <h3>No repositories found</h3>
                    <p>Create a repository before managing branches.</p>
                </div>
            ) : (
                <>
                    <div className="panel" style={{ marginBottom: "20px" }}>
                        <label
                            htmlFor="branch-repository"
                            style={{ display: "block", marginBottom: "10px" }}
                        >
                            Select repository
                        </label>

                        <select
                            id="branch-repository"
                            value={selectedRepository}
                            onChange={event =>
                                setSelectedRepository(event.target.value)
                            }
                            style={{ padding: "12px", minWidth: "260px" }}
                        >
                            {repositories.map(repo => {
                                const id = String(repo._id || repo.id);

                                return (
                                    <option key={id} value={id}>
                                        {repo.name || "Untitled repository"}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {selectedRepository && (
                        <BranchManager
                            key={`${selectedRepository}-${refreshKey}`}
                            repositoryId={selectedRepository}
                            onBranchChanged={handleBranchChanged}
                        />
                    )}
                </>
            )}
        </div>
    );
}

export default Branches;
