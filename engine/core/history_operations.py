import json
import re
from pathlib import Path
from datetime import datetime, timezone

from collections import deque


class HistoryOperations:
    """Safe commit operations, immutable tags and release metadata."""

    def __init__(self, commit_engine, object_store, metadata_path):
        self.commits = commit_engine
        self.store = object_store
        self.metadata = Path(metadata_path)
        self.tags_file = self.metadata / "tags.json"
        self.releases_file = self.metadata / "releases.json"

    def _read(self, path):
        if not path.exists():
            return []
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise ValueError(f"Invalid metadata: {path.name}")
        return data

    def _write(self, path, data):
        temp = path.with_suffix(path.suffix + ".tmp")
        temp.write_text(json.dumps(data, indent=4), encoding="utf-8")
        temp.replace(path)

    def _commit_lookup(self):
        commits = self.commits.get_commits()
        lookup = {c["commit_id"]: c for c in commits}
        if len(lookup) != len(commits):
            raise ValueError("Duplicate commit IDs detected")
        return lookup

    def _validate_commit(self, commit_id, lookup):
        if not isinstance(commit_id, str) or commit_id not in lookup:
            raise ValueError("Commit was not found")
        return lookup[commit_id]

    def _validate_message(self, message):
        if not isinstance(message, str) or not message.strip():
            raise ValueError("A commit message is required")
        return message.strip()

    def _commit_snapshot(self, message, parent, snapshot, metadata=None):
        lookup = self._commit_lookup()
        previous = self.commits.get_snapshot(parent) if parent else {}
        changed = {
            path: value for path, value in snapshot.items()
            if previous.get(path) != value
        }
        deleted = sorted(set(previous) - set(snapshot))

        if not changed and not deleted:
            raise ValueError("Operation produces no changes")

        data = {
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "parent": parent,
            "branch": self.commits.branch_engine.get_current_branch(),
            "files": changed,
            "deleted_files": deleted,
            "snapshot": dict(snapshot)
        }
        if metadata:
            data.update(metadata)

        import hashlib
        content = json.dumps(data, sort_keys=True).encode("utf-8")
        commit_id = hashlib.sha256(content).hexdigest()
        commit = {"commit_id": commit_id, **data}

        commits = self.commits.get_commits()
        commits.append(commit)
        self.commits.save_commits(commits)
        self.commits.branch_engine.update_branch_commit(commit_id)
        return commit

    def _merge(self, base, current, incoming):
        merged = {}
        conflicts = []
        for path in sorted(set(base) | set(current) | set(incoming)):
            b, c, n = base.get(path), current.get(path), incoming.get(path)
            if c == n:
                value = c
            elif c == b:
                value = n
            elif n == b:
                value = c
            else:
                conflicts.append(path)
                continue
            if value is not None:
                merged[path] = value
        return merged, conflicts

    def cherry_pick(self, commit_id, message=None):
        lookup = self._commit_lookup()
        source = self._validate_commit(commit_id, lookup)
        parent = source.get("parent")
        if not parent:
            raise ValueError("Cannot cherry-pick an initial commit")

        base = self.commits.get_snapshot(parent)
        incoming = self.commits.get_snapshot(commit_id)
        current_id = self.commits.branch_engine.get_branch_commit()
        current = self.commits.get_snapshot(current_id)

        merged, conflicts = self._merge(base, current, incoming)
        if conflicts:
            return {"status": "conflict", "conflicts": conflicts}

        result = self._commit_snapshot(
            self._validate_message(message or f"Cherry-pick: {source['message']}"),
            current_id,
            merged,
            {"cherry_pick_source": commit_id}
        )
        return {"status": "cherry_picked", "commit": result}

    def revert(self, commit_id, message=None, mainline_parent=None):
        lookup = self._commit_lookup()
        target = self._validate_commit(commit_id, lookup)

        if target.get("second_parent"):
            if mainline_parent not in (1, 2):
                raise ValueError(
                    "Reverting a merge requires mainline_parent 1 or 2"
                )
            base_id = target.get("parent" if mainline_parent == 1 else "second_parent")
        else:
            if mainline_parent not in (None, 1):
                raise ValueError("Invalid mainline parent")
            base_id = target.get("parent")

        if not base_id:
            raise ValueError("Cannot revert an initial commit")

        original_parent_snapshot = self.commits.get_snapshot(base_id)
        target_snapshot = self.commits.get_snapshot(commit_id)
        current_id = self.commits.branch_engine.get_branch_commit()
        current_snapshot = self.commits.get_snapshot(current_id)

        # Reverse the selected commit's change and apply it to current HEAD.
        merged, conflicts = self._merge(
            target_snapshot, current_snapshot, original_parent_snapshot
        )
        if conflicts:
            return {"status": "conflict", "conflicts": conflicts}

        result = self._commit_snapshot(
            self._validate_message(message or f"Revert: {target['message']}"),
            current_id,
            merged,
            {"reverts": commit_id}
        )
        return {"status": "reverted", "commit": result}

    def create_tag(self, name, commit_id=None, message=""):
        if not isinstance(name, str) or not re.fullmatch(
            r"[A-Za-z0-9][A-Za-z0-9._-]{0,99}", name.strip()
        ):
            raise ValueError("Invalid tag name")
        name = name.strip()

        tags = self._read(self.tags_file)
        if any(item["name"] == name for item in tags):
            raise ValueError("Tag already exists")

        lookup = self._commit_lookup()
        if commit_id is None:
            commit_id = self.commits.branch_engine.get_branch_commit()
        self._validate_commit(commit_id, lookup)

        tag = {
            "name": name,
            "commit_id": commit_id,
            "message": str(message).strip(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        tags.append(tag)
        self._write(self.tags_file, tags)
        return tag

    def list_tags(self):
        return self._read(self.tags_file)

    def create_release(self, title, tag_name, description=""):
        if not isinstance(title, str) or not title.strip():
            raise ValueError("Release title is required")
        if not isinstance(tag_name, str) or not tag_name.strip():
            raise ValueError("Release tag is required")
        if not isinstance(description, str):
            raise ValueError("Release description must be text")

        tags = self._read(self.tags_file)
        tag = next(
            (item for item in tags if item["name"] == tag_name.strip()),
            None
        )
        if tag is None:
            raise ValueError("Create a tag before publishing a release")

        releases = self._read(self.releases_file)
        if any(item["tag_name"] == tag["name"] for item in releases):
            raise ValueError("A release already exists for this tag")

        release = {
            "title": title.strip(),
            "tag_name": tag["name"],
            "commit_id": tag["commit_id"],
            "description": description.strip(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        releases.append(release)
        self._write(self.releases_file, releases)
        return release

    def list_releases(self):
        return self._read(self.releases_file)
