import { useMemo } from "react";
import "./RepositoryInsights.css";

const DAY = 24 * 60 * 60 * 1000;

function getDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export default function RepositoryInsights({ commits = [], repositoryId = "" }) {
    const analytics = useMemo(() => {
        const valid = commits.filter(commit => commit && commit.commit_id);
        const now = new Date();
        const days = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - i);
            const next = new Date(date);
            next.setDate(next.getDate() + 1);

            const count = valid.filter(commit => {
                const timestamp = getDate(commit.timestamp);
                return timestamp && timestamp >= date && timestamp < next;
            }).length;

            days.push({
                label: date.toLocaleDateString(undefined, { weekday: "short" }),
                date: date.toLocaleDateString(),
                count
            });
        }

        const branchMap = new Map();
        const fileSet = new Set();
        let additions = 0;
        let deletions = 0;
        let latest = null;

        valid.forEach(commit => {
            const branch = commit.branch || "Unknown branch";
            branchMap.set(branch, (branchMap.get(branch) || 0) + 1);

            const timestamp = getDate(commit.timestamp);
            if (timestamp && (!latest || timestamp > latest)) latest = timestamp;

            const files = commit.files && typeof commit.files === "object"
                ? Object.keys(commit.files)
                : [];

            const deleted = Array.isArray(commit.deleted_files)
                ? commit.deleted_files
                : [];

            files.forEach(file => fileSet.add(file));
            deleted.forEach(file => fileSet.add(file));

            additions += files.length;
            deletions += deleted.length;
        });

        const branches = [...branchMap.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const recentCount = days.reduce((sum, day) => sum + day.count, 0);

        return {
            total: valid.length,
            branches,
            days,
            recentCount,
            latest,
            files: fileSet.size,
            additions,
            deletions,
            maximum: Math.max(1, ...days.map(day => day.count))
        };
    }, [commits]);

    const activityLabel = !analytics.latest
        ? "No timestamp available"
        : new Date().getTime() - analytics.latest.getTime() <= 7 * DAY
            ? "Active recently"
            : "No commits in the last 7 days";

    return (
        <section className="repository-insights">
            <div className="repository-insights__header">
                <div>
                    <span className="repository-insights__eyebrow">REPOSITORY ANALYTICS</span>
                    <h2>Repository Insights</h2>
                    <p>Understand your repository's development activity.</p>
                </div>
                <span className="repository-insights__status">
                    {activityLabel}
                </span>
            </div>

            <div className="repository-insights__stats">
                <article className="repository-insights__stat">
                    <span>Total commits</span>
                    <strong>{analytics.total}</strong>
                    <small>Recorded commit history</small>
                </article>
                <article className="repository-insights__stat">
                    <span>Branches in history</span>
                    <strong>{analytics.branches.length}</strong>
                    <small>Branches represented by commits</small>
                </article>
                <article className="repository-insights__stat">
                    <span>Last 7 days</span>
                    <strong>{analytics.recentCount}</strong>
                    <small>Commits during this period</small>
                </article>
                <article className="repository-insights__stat">
                    <span>Unique files changed</span>
                    <strong>{analytics.files}</strong>
                    <small>Across available commit records</small>
                </article>
            </div>

            <div className="repository-insights__grid">
                <article className="repository-insights__panel">
                    <h3>Commit activity</h3>
                    <p>Daily commits over the last seven days</p>
                    <div className="repository-insights__chart">
                        {analytics.days.map(day => (
                            <div className="repository-insights__bar-column" key={day.date}>
                                <strong>{day.count}</strong>
                                <div className="repository-insights__bar-track">
                                    <div
                                        className="repository-insights__bar"
                                        style={{ height: `${Math.max(4, day.count / analytics.maximum * 100)}%` }}
                                    />
                                </div>
                                <span>{day.label}</span>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="repository-insights__panel">
                    <h3>Branch activity</h3>
                    <p>Commits grouped by recorded branch</p>
                    {analytics.branches.length === 0 ? (
                        <div className="repository-insights__empty">No branch activity available yet.</div>
                    ) : (
                        <div className="repository-insights__branches">
                            {analytics.branches.map(branch => (
                                <div className="repository-insights__branch" key={branch.name}>
                                    <div>
                                        <strong>{branch.name}</strong>
                                        <span>{branch.count} commits</span>
                                    </div>
                                    <div className="repository-insights__branch-track">
                                        <div style={{
                                            width: `${branch.count / analytics.total * 100}%`
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </article>
            </div>

            <article className="repository-insights__panel repository-insights__changes">
                <div>
                    <h3>Code change statistics</h3>
                    <p>File entries recorded in commit history. These are not line-level code metrics.</p>
                </div>
                <div className="repository-insights__change-items">
                    <div><strong>{analytics.additions}</strong><span>File additions or updates</span></div>
                    <div><strong>{analytics.deletions}</strong><span>File deletion records</span></div>
                    <div><strong>{analytics.latest ? analytics.latest.toLocaleString() : "Unavailable"}</strong><span>Latest recorded commit</span></div>
                </div>
            </article>

            <div className="repository-insights__footnote">
                Analytics are calculated from the commit history returned for this repository.
                {repositoryId ? " Repository data is scoped to the selected repository." : ""}
                {" "}Contributor identities are not available in the current commit metadata.
            </div>
        </section>
    );
}
