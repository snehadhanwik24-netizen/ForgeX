import { useState, useEffect } from "react";
import Repositories from "./Repositories";
import Commits from "./Commits";
import Branches from "./Branches";
import { fetchDashboardRepositories, fetchDashboardStats } from "../services/dashboardApi";
import "../Dashboard.css";

function Dashboard() {
    const [activePage, setActivePage] = useState("Overview");
    const [repositoryCount, setRepositoryCount] = useState(0);
    const [repositoryLoading, setRepositoryLoading] = useState(true);
    const [totalCommits, setTotalCommits] = useState(0);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        const loadDashboardRepositories = async () => {
            try {
                const data = await fetchDashboardRepositories();
                setRepositoryCount(data.count);
            } catch (error) {
                console.error("Dashboard repository loading failed:", error);
            } finally {
                setRepositoryLoading(false);
            }
        };

        loadDashboardRepositories();
        const loadDashboardStats = async () => {
            try {
                const data = await fetchDashboardStats();
                setTotalCommits(data.totalCommits);
            } catch (error) {
                console.error("Dashboard statistics loading failed:", error);
            } finally {
                setStatsLoading(false);
            }
        };
        loadDashboardStats();
    }, []);
    const user = JSON.parse(
        localStorage.getItem("forgex_user") || "{}"
    );

    const navigation = [
        { name: "Overview", icon: "\u{1F3E0}" },
        { name: "Repositories", icon: "\u{1F4C1}" },
        { name: "Commits", icon: "\u{1F550}" },
        { name: "Branches", icon: "\u{1F33F}" },
        { name: "Pull Requests", icon: "\u{1F500}" },
        { name: "Code Review", icon: "\u{1F916}" }
    ];

    const openRepositories = () => {
        setActivePage("Repositories");
    };

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <div className="brand-icon">FX</div>
                    <h2>ForgeX</h2>
                </div>

                <div className="workspace-label">WORKSPACE</div>

                <nav>
                    {navigation.map((item) => (
                        <button
                            key={item.name}
                            className={
                                activePage === item.name
                                    ? "nav-item active"
                                    : "nav-item"
                            }
                            onClick={() => setActivePage(item.name)}
                        >
                            <span>{item.icon}</span>
                            {item.name}
                        </button>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    <div className="user-avatar">
                        {(user.name || "D").charAt(0).toUpperCase()}
                    </div>

                    <div className="user-details">
                        <strong>{user.name || "Developer"}</strong>
                        <span>@{user.username || "developer"}</span>
                    </div>

                    <button
                        className="logout-button"
                        onClick={() => {
                            localStorage.removeItem("forgex_token");
                            localStorage.removeItem("forgex_user");
                            window.location.reload();
                        }}
                    >
                        {"\u{1F6AA}"}
                    </button>
                </div>
            </aside>

            <main className="dashboard-main">
                <header className="topbar">
                    <div>
                        <span className="breadcrumb">Workspace /</span>
                        <strong>{activePage}</strong>
                    </div>

                    <div className="topbar-right">
                        <span className="status-dot"></span>
                        <span>All systems operational</span>
                        <div className="top-avatar">
                            {(user.name || "D").charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                <section className="dashboard-content">
                    {activePage === "Repositories" ? (
                        <Repositories />
                    ) : activePage === "Commits" ? (
                        <Commits />
                    ) : activePage === "Branches" ? (
                        <Branches />
                    ) : activePage === "Overview" ? (
                        <>
                            <div className="welcome-section">
                                <div>
                                    <p className="eyebrow">YOUR WORKSPACE</p>
                                    <h1>Welcome back, {user.name || "Developer"}! {"\u{1F44B}"}</h1>
                                    <p>
                                        Here's what's happening in your development workspace.
                                    </p>
                                </div>

                                <button
                                    className="primary-button"
                                    onClick={openRepositories}
                                >
                                    + New Repository
                                </button>
                            </div>

                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-card-top">
                                        <span>Repositories</span>
                                        <div className="stat-icon repository-icon">{"\u{1F4C1}"}</div>
                                    </div>
                                    <h2>{repositoryLoading ? "..." : repositoryCount}</h2>
                                    <small>Your projects</small>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-card-top">
                                        <span>Total Commits</span>
                                        <div className="stat-icon commits-icon">{"\u{1F680}"}</div>
                                    </div>
                                    <h2>{statsLoading ? "..." : totalCommits}</h2>
                                    <small>Version history</small>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-card-top">
                                        <span>Branches</span>
                                        <div className="stat-icon branches-icon">{"\u{1F33F}"}</div>
                                    </div>
                                    <h2>0</h2>
                                    <small>Development branches</small>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-card-top">
                                        <span>Pull Requests</span>
                                        <div className="stat-icon pull-icon">{"\u{1F500}"}</div>
                                    </div>
                                    <h2>0</h2>
                                    <small>Collaboration activity</small>
                                </div>
                            </div>

                            <div className="content-grid">
                                <section className="panel activity-panel">
                                    <div className="panel-heading">
                                        <h3>Recent Activity</h3>
                                        <span>Latest updates</span>
                                    </div>

                                    <div className="empty-state">
                                        <div className="empty-icon">{"\u{1F4AD}"}</div>
                                        <h3>Nothing happening yet!</h3>
                                        <p>
                                            Your commits, repository updates and
                                            collaboration activity will appear here.
                                        </p>
                                    </div>
                                </section>

                                <section className="panel quick-panel">
                                    <div className="panel-heading">
                                        <h3>Quick Actions</h3>
                                    </div>

                                    <button
                                        className="quick-action"
                                        onClick={openRepositories}
                                    ><span>{"\u{1F4C1}"}</span>
                                        <div>
                                            <strong>Create Repository</strong>
                                            <small>Start a new project</small>
                                        </div>
                                    </button>

                                    <button
                                        className="quick-action"
                                        onClick={() => setActivePage("Branches")}
                                    ><span>{"\u{1F33F}"}</span>
                                        <div>
                                            <strong>Create Branch</strong>
                                            <small>Start a new development branch</small>
                                        </div>
                                    </button>

                                    <button
                                        className="quick-action"
                                        onClick={() => setActivePage("Code Review")}
                                    ><span>{"\u{1F916}"}</span>
                                        <div>
                                            <strong>Review Code</strong>
                                            <small>Explore AI-powered reviews</small>
                                        </div>
                                    </button>
                                </section>
                            </div>
                        </>
                    ) : (
                        <div className="panel">
                            <h2>{activePage}</h2>
                            <p>This feature is coming soon to ForgeX.</p>
                        </div>
                    )}

                    <footer className="dashboard-footer">
                        ForgeX © 2026 · Built for developers
                    </footer>
                </section>
            </main>
        </div>
    );
}

export default Dashboard;











