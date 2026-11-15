import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone

from core.branch_engine import BranchEngine


class CommitEngine:

    def __init__(self, metadata_path="engine/storage/metadata"):
        self.metadata_path = Path(metadata_path)
        self.metadata_path.mkdir(parents=True, exist_ok=True)

        self.commit_file = self.metadata_path / "commits.json"
        self.branch_engine = BranchEngine(self.metadata_path)

        if not self.commit_file.exists():
            self.save_commits([])

        commits = self.get_commits()
        branches = self.branch_engine._load_branches()

        if (
            len(branches) == 1
            and "main" in branches
            and self.branch_engine.get_current_branch() == "main"
            and branches["main"] is None
            and commits
        ):
            self.branch_engine.update_branch_commit(
                commits[-1]["commit_id"]
            )

    def save_commits(self, commits):
        with open(self.commit_file, "w", encoding="utf-8") as file:
            json.dump(commits, file, indent=4)

    def get_commits(self):
        with open(self.commit_file, "r", encoding="utf-8") as file:
            return json.load(file)

    def _build_snapshot(self, commit_id, commit_lookup, visited=None):
        if not commit_id:
            return {}

        if visited is None:
            visited = set()

        if commit_id in visited:
            raise ValueError("Circular commit history detected")

        commit = commit_lookup.get(commit_id)

        if commit is None:
            raise ValueError("Parent commit was not found")

        visited.add(commit_id)

        # New commits already contain a complete snapshot.
        if isinstance(commit.get("snapshot"), dict):
            snapshot = dict(commit["snapshot"])
        else:
            # Reconstruct snapshots for older commits.
            snapshot = self._build_snapshot(
                commit.get("parent"),
                commit_lookup,
                visited
            )

            changed_files = commit.get("files", {})

            if not isinstance(changed_files, dict):
                raise ValueError("Invalid commit file data")

            snapshot.update(changed_files)

            deleted_files = commit.get("deleted_files", [])

            if not isinstance(deleted_files, list):
                raise ValueError("Invalid deleted file data")

            for file_path in deleted_files:
                snapshot.pop(file_path, None)

        visited.remove(commit_id)
        return snapshot

    def get_snapshot(self, commit_id=None):
        commits = self.get_commits()

        if commit_id is None:
            commit_id = self.branch_engine.get_branch_commit()

        if not commit_id:
            return {}

        commit_lookup = {
            commit["commit_id"]: commit
            for commit in commits
        }

        return self._build_snapshot(commit_id, commit_lookup)

    def create_commit(self, message, staged_files, deleted_files=None):
        if not isinstance(message, str) or not message.strip():
            raise ValueError("Commit message cannot be empty")

        if not isinstance(staged_files, dict) or not staged_files:
            if not deleted_files:
                raise ValueError("No files staged for commit")

        if deleted_files is None:
            deleted_files = []

        if not isinstance(deleted_files, list):
            raise ValueError("Deleted files must be a list")

        if any(
            not isinstance(path, str) or not path.strip()
            for path in deleted_files
        ):
            raise ValueError("Invalid deleted file path")

        if len(set(deleted_files)) != len(deleted_files):
            raise ValueError("Duplicate deleted file path")

        if set(staged_files).intersection(deleted_files):
            raise ValueError("A file cannot be staged and deleted together")

        commits = self.get_commits()

        parent = self.branch_engine.get_branch_commit()

        commit_lookup = {
            commit["commit_id"]: commit
            for commit in commits
        }

        snapshot = self._build_snapshot(parent, commit_lookup)

        snapshot.update(staged_files)

        for file_path in deleted_files:
            snapshot.pop(file_path, None)

        commit_data = {
            "message": message.strip(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "parent": parent,
            "branch": self.branch_engine.get_current_branch(),
            "files": staged_files,
            "deleted_files": deleted_files,
            "snapshot": snapshot
        }

        commit_content = json.dumps(
            commit_data,
            sort_keys=True
        ).encode("utf-8")

        commit_id = hashlib.sha256(commit_content).hexdigest()

        commit = {
            "commit_id": commit_id,
            **commit_data
        }

        commits.append(commit)
        self.save_commits(commits)

        self.branch_engine.update_branch_commit(commit_id)

        return commit

    def get_history(self):
        commits = self.get_commits()
        current_commit_id = self.branch_engine.get_branch_commit()

        commit_lookup = {
            commit["commit_id"]: commit
            for commit in commits
        }

        history = []
        visited = set()

        while current_commit_id:
            if current_commit_id in visited:
                raise ValueError("Circular commit history detected")

            visited.add(current_commit_id)

            commit = commit_lookup.get(current_commit_id)

            if commit is None:
                raise ValueError("Commit referenced by branch was not found")

            history.append(commit)
            current_commit_id = commit.get("parent")

        return history
