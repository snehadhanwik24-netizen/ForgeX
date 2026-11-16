import { useEffect, useMemo, useState } from "react";
import {
    fetchRepositoryTags,
    fetchRepositoryReleases
} from "../services/commitApi";
import "./ReleaseCenter.css";

function formatDate(value) {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Date unavailable"
        : date.toLocaleString();
}

export default function ReleaseCenter({ repositoryId, commits = [] }) {
    const [tags, setTags] = useState([]);
    const [releases, setReleases] = useState([]);
    const [selectedRelease, setSelectedRelease] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        async function load() {
            setLoading(true);
            setError("");

            try {
                const [tagData, releaseData] = await Promise.all([
                    fetchRepositoryTags(repositoryId),
                    fetchRepositoryReleases(repositoryId)
                ]);

                if (active) {
                    const safeTags = Array.isArray(tagData) ? tagData : [];
                    const safeReleases = Array.isArray(releaseData) ? releaseData : [];

                    setTags(safeTags);
                    setReleases(safeReleases);
                    setSelectedRelease(current =>
                        safeReleases.some(item => item.tag_name === current)
                            ? current
                            : safeReleases[0]?.tag_name || ""
                    );
                }
            } catch (err) {
                if (active) setError(err.message);
            } finally {
                if (active) setLoading(false);
            }
        }

        if (repositoryId) load();

        return () => {
            active = false;
        };
    }, [repositoryId]);

    const release = releases.find(
        item => item.tag_name === selectedRelease
    );

    const activity = useMemo(() => {
        const items = [
            ...commits.map(commit => ({
                id: commit.commit_id,
                type: commit.is_merge ? "Merge" : "Commit",
                title: commit.message,
                date: commit.timestamp,
                detail: commit.branch || "Repository commit",
                hash: commit.commit_id
            })),
            ...tags.map(tag => ({
                id: `tag-${tag.name}`,
                type: "Tag",
                title: tag.name,
                date: tag.created_at,
                detail: `Version tag · ${tag.commit_id?.slice(0, 10) || ""}`
            })),
            ...releases.map(item => ({
                id: `release-${item.tag_name}`,
                type: "Release",
                title: item.title,
                date: item.created_at,
                detail: `Published ${item.tag_name}`
            }))
        ];

        return items.sort(
            (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
        );
    }, [commits, tags, releases]);

    const weeklyActivity = useMemo(() => {
        const days = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - i);

            const count = commits.filter(commit => {
                if (!commit.timestamp) return false;
                const commitDate = new Date(commit.timestamp);
                return commitDate.toDateString() === date.toDateString();
            }).length;

            days.push({
                label: date.toLocaleDateString(undefined, { weekday: "short" }),
                count
            });
        }

        return days;
    }, [commits]);

    const maximum = Math.max(1, ...weeklyActivity.map(day => day.count));
    const changedFiles = commits.reduce(
        (total, commit) => total + Object.keys(commit.files || {}).length +
            (commit.deleted_files || []).length,
        0
    );

    return (
        <section className="release-center">
            <div className="release-center__heading">
                <div>
                    <span className="release-center__eyebrow">INSIGHTS & VERSIONS</span>
                    <h2>Release Center</h2>
                    <p>Your repository releases, development activity and project metrics.</p>
                </div>
                <span className="release-center__live">Repository analytics</span>
            </div>

            {error && <div className="release-center__error">{error}</div>}

            {loading ? (
                <div className="release-center__empty">Loading repository insights...</div>
            ) : (
                <>
                    <div className="release-center__stats">
                        <article>
                            <span>Total commits</span>
                            <strong>{commits.length}</strong>
                        </article>
                        <article>
                            <span>Version tags</span>
                            <strong>{tags.length}</strong>
                        </article>
                        <article>
                            <span>Published releases</span>
                            <strong>{releases.length}</strong>
                        </article>
                        <article>
                            <span>File changes recorded</span>
                            <strong>{changedFiles}</strong>
                        </article>
                    </div>

                    <div className="release-center__grid">
                        <article className="release-center__panel">
                            <div className="release-center__panel-heading">
                                <div>
                                    <h3>Release explorer</h3>
                                    <p>Inspect published versions and their details.</p>
                                </div>
                            </div>

                            {releases.length === 0 ? (
                                <div className="release-center__empty">
                                    No published releases yet. Publish your first release above.
                                </div>
                            ) : (
                                <>
                                    <label htmlFor="release-explorer">Select release</label>
                                    <select
                                        id="release-explorer"
                                        value={selectedRelease}
                                        onChange={event => setSelectedRelease(event.target.value)}
                                    >
                                        {releases.map(item => (
                                            <option key={item.tag_name} value={item.tag_name}>
                                                {item.title} · {item.tag_name}
                                            </option>
                                        ))}
                                    </select>

                                    {release && (
                                        <div className="release-center__release-detail">
                                            <span className="release-center__version">
                                                {release.tag_name}
                                            </span>
                                            <h3>{release.title}</h3>
                                            <p>{release.description || "No release notes provided."}</p>
                                            <div>
                                                <span>Commit</span>
                                                <code>{release.commit_id}</code>
                                            </div>
                                            <div>
                                                <span>Published</span>
                                                <strong>{formatDate(release.created_at)}</strong>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </article>

                        <article className="release-center__panel">
                            <h3>Commit activity</h3>
                            <p>Daily commit count over the last seven days.</p>

                            <div className="release-center__chart">
                                {weeklyActivity.map(day => (
                                    <div className="release-center__bar-group" key={day.label}>
                                        <strong>{day.count}</strong>
                                        <div className="release-center__bar-track">
                                            <div
                                                className="release-center__bar"
                                                style={{ height: `${Math.max(5, day.count / maximum * 100)}%` }}
                                            />
                                        </div>
                                        <span>{day.label}</span>
                                    </div>
                                ))}
                            </div>
                        </article>
                    </div>

                    <article className="release-center__panel release-center__timeline">
                        <div className="release-center__panel-heading">
                            <div>
                                <h3>Repository activity</h3>
                                <p>A unified timeline of commits, tags and releases.</p>
                            </div>
                            <span>{activity.length} events</span>
                        </div>

                        {activity.length === 0 ? (
                            <div className="release-center__empty">No repository activity recorded yet.</div>
                        ) : (
                            <div className="release-center__events">
                                {activity.slice(0, 30).map(item => (
                                    <div className="release-center__event" key={item.id}>
                                        <span className={`release-center__event-dot release-center__event-dot--${item.type.toLowerCase()}`} />
                                        <div>
                                            <span className="release-center__event-type">{item.type}</span>
                                            <strong>{item.title || "Untitled event"}</strong>
                                            <small>{item.detail}</small>
                                            <time>{formatDate(item.date)}</time>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>
                </>
            )}
        </section>
    );
}
