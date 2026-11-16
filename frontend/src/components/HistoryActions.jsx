import { useEffect, useState } from "react";
import {
    revertRepositoryCommit,
    cherryPickRepositoryCommit,
    fetchRepositoryTags,
    createRepositoryTag,
    fetchRepositoryReleases,
    createRepositoryRelease
} from "../services/commitApi";
import "./HistoryActions.css";

export default function HistoryActions({ repositoryId, commits = [] }) {
    const [selectedCommit, setSelectedCommit] = useState("");
    const [tags, setTags] = useState([]);
    const [releases, setReleases] = useState([]);
    const [tagName, setTagName] = useState("");
    const [tagMessage, setTagMessage] = useState("");
    const [releaseTitle, setReleaseTitle] = useState("");
    const [releaseTag, setReleaseTag] = useState("");
    const [releaseDescription, setReleaseDescription] = useState("");
    const [mainline, setMainline] = useState("1");
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    const activeCommit = selectedCommit || commits[0]?.commit_id;
    const selected = commits.find(
        commit => commit.commit_id === activeCommit
    );

    useEffect(() => {
        let active = true;

        async function loadMetadata() {
            if (!repositoryId) {
                setTags([]);
                setReleases([]);
                return;
            }

            try {
                const [tagData, releaseData] = await Promise.all([
                    fetchRepositoryTags(repositoryId),
                    fetchRepositoryReleases(repositoryId)
                ]);

                if (active) {
                    setTags(Array.isArray(tagData) ? tagData : []);
                    setReleases(Array.isArray(releaseData) ? releaseData : []);
                    setError("");
                }
            } catch (err) {
                if (active) setError(err.message);
            }
        }

        loadMetadata();

        return () => {
            active = false;
        };
    }, [repositoryId]);

    async function refreshMetadata() {
        const [tagData, releaseData] = await Promise.all([
            fetchRepositoryTags(repositoryId),
            fetchRepositoryReleases(repositoryId)
        ]);
        setTags(Array.isArray(tagData) ? tagData : []);
        setReleases(Array.isArray(releaseData) ? releaseData : []);
    }

    async function performHistoryAction(action) {
        if (!activeCommit) {
            setError("Select a commit first");
            return;
        }

        const label = action === "revert" ? "revert" : "cherry-pick";

        if (!window.confirm(`Are you sure you want to ${label} this commit?`)) {
            return;
        }

        setBusy(true);
        setError("");
        setNotice("");

        try {
            const payload = {
                commit_id: activeCommit,
                ...(action === "revert" && selected?.second_parent
                    ? { mainline_parent: Number(mainline) }
                    : {})
            };

            if (action === "revert") {
                await revertRepositoryCommit(repositoryId, payload);
            } else {
                await cherryPickRepositoryCommit(repositoryId, payload);
            }

            setNotice(`${label} completed successfully.`);
            window.location.reload();
        } catch (err) {
            const conflictText = err.conflicts?.length
                ? ` Conflicting files: ${err.conflicts.join(", ")}`
                : "";
            setError(`${err.message}${conflictText}`);
        } finally {
            setBusy(false);
        }
    }

    async function handleCreateTag(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");

        try {
            await createRepositoryTag(repositoryId, {
                name: tagName,
                commit_id: activeCommit,
                message: tagMessage
            });
            setTagName("");
            setTagMessage("");
            await refreshMetadata();
            setNotice("Tag created successfully.");
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function handleCreateRelease(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");

        try {
            await createRepositoryRelease(repositoryId, {
                title: releaseTitle,
                tag_name: releaseTag,
                description: releaseDescription
            });
            setReleaseTitle("");
            setReleaseDescription("");
            await refreshMetadata();
            setNotice("Release published successfully.");
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="history-actions">
            <div className="history-actions__heading">
                <div>
                    <span className="history-actions__eyebrow">REPOSITORY TOOLS</span>
                    <h2>History &amp; Releases</h2>
                    <p>Manage commit history, version tags and published releases.</p>
                </div>
            </div>

            {error && (
                <div className="history-actions__alert history-actions__alert--error">
                    {error}
                </div>
            )}
            {notice && (
                <div className="history-actions__alert history-actions__alert--success">
                    {notice}
                </div>
            )}

            <div className="history-actions__grid">
                <article className="history-actions__card">
                    <h3>Commit operations</h3>
                    <label htmlFor="history-commit">Choose a commit</label>
                    <select
                        id="history-commit"
                        value={activeCommit || ""}
                        onChange={event => setSelectedCommit(event.target.value)}
                    >
                        <option value="">Select commit</option>
                        {commits.map(commit => (
                            <option key={commit.commit_id} value={commit.commit_id}>
                                {commit.message} · {commit.commit_id.slice(0, 8)}
                            </option>
                        ))}
                    </select>

                    {selected?.second_parent && (
                        <div className="history-actions__field">
                            <label htmlFor="history-mainline">Merge revert mainline</label>
                            <select
                                id="history-mainline"
                                value={mainline}
                                onChange={event => setMainline(event.target.value)}
                            >
                                <option value="1">Parent 1 — target branch</option>
                                <option value="2">Parent 2 — merged branch</option>
                            </select>
                        </div>
                    )}

                    <div className="history-actions__buttons">
                        <button
                            disabled={busy || !activeCommit}
                            onClick={() => performHistoryAction("revert")}
                        >
                            Revert commit
                        </button>
                        <button
                            disabled={busy || !activeCommit}
                            onClick={() => performHistoryAction("cherry_pick")}
                        >
                            Cherry-pick commit
                        </button>
                    </div>
                    <small>Both operations create a new commit. Existing history is preserved.</small>
                </article>

                <article className="history-actions__card">
                    <h3>Version tags</h3>
                    <form onSubmit={handleCreateTag}>
                        <label htmlFor="history-tag-name">Tag name</label>
                        <input
                            id="history-tag-name"
                            value={tagName}
                            onChange={event => setTagName(event.target.value)}
                            placeholder="e.g. v1.0.0"
                            required
                        />
                        <label htmlFor="history-tag-message">Tag message</label>
                        <input
                            id="history-tag-message"
                            value={tagMessage}
                            onChange={event => setTagMessage(event.target.value)}
                            placeholder="Stable release"
                        />
                        <button disabled={busy || !activeCommit || !tagName.trim()}>
                            Create tag at selected commit
                        </button>
                    </form>
                    <div className="history-actions__list">
                        {tags.length === 0 ? <p>No tags created yet.</p> : tags.map(tag => (
                            <div className="history-actions__item" key={tag.name}>
                                <strong>{tag.name}</strong>
                                <code>{tag.commit_id.slice(0, 10)}</code>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="history-actions__card">
                    <h3>Publish a release</h3>
                    <form onSubmit={handleCreateRelease}>
                        <label htmlFor="history-release-title">Release title</label>
                        <input
                            id="history-release-title"
                            value={releaseTitle}
                            onChange={event => setReleaseTitle(event.target.value)}
                            placeholder="ForgeX 1.0.0"
                            required
                        />
                        <label htmlFor="history-release-tag">Release tag</label>
                        <select
                            id="history-release-tag"
                            value={releaseTag}
                            onChange={event => setReleaseTag(event.target.value)}
                            required
                        >
                            <option value="">Choose a tag</option>
                            {tags.map(tag => (
                                <option key={tag.name} value={tag.name}>{tag.name}</option>
                            ))}
                        </select>
                        <label htmlFor="history-release-description">Release notes</label>
                        <textarea
                            id="history-release-description"
                            value={releaseDescription}
                            onChange={event => setReleaseDescription(event.target.value)}
                            placeholder="What's new in this release?"
                            rows={3}
                        />
                        <button disabled={busy || !releaseTitle.trim() || !releaseTag}>
                            Publish release
                        </button>
                    </form>
                    <div className="history-actions__list">
                        {releases.length === 0 ? <p>No releases published yet.</p> : releases.map(release => (
                            <div className="history-actions__item" key={release.tag_name}>
                                <strong>{release.title}</strong>
                                <span>{release.tag_name}</span>
                                <p>{release.description}</p>
                            </div>
                        ))}
                    </div>
                </article>
            </div>
        </section>
    );
}
