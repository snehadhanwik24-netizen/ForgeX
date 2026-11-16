import hashlib
import json
from collections import deque
from datetime import datetime, timezone


class MergeEngine:

    def __init__(self, commit_engine, object_store=None):
        self.commit_engine = commit_engine
        self.branch_engine = commit_engine.branch_engine
        self.object_store = object_store

    def _get_ancestors(self, commit_id, commit_lookup):
        distances = {}
        queue = deque([(commit_id, 0)])

        while queue:
            current_id, distance = queue.popleft()

            if not current_id or current_id in distances:
                continue

            commit = commit_lookup.get(current_id)

            if commit is None:
                raise ValueError(f"Commit not found: {current_id}")

            distances[current_id] = distance

            for parent in (
                commit.get("parent"),
                commit.get("second_parent")
            ):
                if parent and parent not in distances:
                    queue.append((parent, distance + 1))

        return distances

    def find_common_ancestor(self, target_id, source_id):
        if not target_id or not source_id:
            return None

        commits = self.commit_engine.get_commits()
        lookup = {
            commit["commit_id"]: commit
            for commit in commits
        }

        target_ancestors = self._get_ancestors(
            target_id, lookup
        )
        source_ancestors = self._get_ancestors(
            source_id, lookup
        )

        common = set(target_ancestors) & set(source_ancestors)

        if not common:
            return None

        return min(
            common,
            key=lambda commit_id: (
                target_ancestors[commit_id]
                + source_ancestors[commit_id],
                max(
                    target_ancestors[commit_id],
                    source_ancestors[commit_id]
                )
            )
        )

    def merge_snapshots(
        self,
        base_snapshot,
        target_snapshot,
        source_snapshot
    ):
        merged = {}
        conflicts = []

        all_paths = (
            set(base_snapshot)
            | set(target_snapshot)
            | set(source_snapshot)
        )

        for path in sorted(all_paths):
            base = base_snapshot.get(path)
            target = target_snapshot.get(path)
            source = source_snapshot.get(path)

            if target == source:
                result = target
            elif target == base:
                result = source
            elif source == base:
                result = target
            else:
                conflicts.append({
                    "path": path,
                    "base": base,
                    "target": target,
                    "source": source
                })
                continue

            if result is not None:
                merged[path] = result

        return {
            "merged_snapshot": merged,
            "conflicts": conflicts,
            "success": len(conflicts) == 0
        }

    def _create_merge_commit(
        self,
        message,
        target_branch,
        target_parent,
        source_parent,
        snapshot
    ):
        if not isinstance(message, str) or not message.strip():
            raise ValueError("Merge message cannot be empty")

        commit_data = {
            "message": message.strip(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "parent": target_parent,
            "second_parent": source_parent,
            "branch": target_branch,
            "source_branch": None,
            "files": {},
            "deleted_files": [],
            "snapshot": snapshot,
            "is_merge": True
        }

        content = json.dumps(
            commit_data,
            sort_keys=True
        ).encode("utf-8")

        commit_id = hashlib.sha256(content).hexdigest()

        commit = {
            "commit_id": commit_id,
            **commit_data
        }

        commits = self.commit_engine.get_commits()
        commits.append(commit)
        self.commit_engine.save_commits(commits)

        self.branch_engine.update_branch_commit(commit_id)

        return commit


    def get_conflict_details(self, source_branch):
        target_branch = self.branch_engine.get_current_branch()

        if not isinstance(source_branch, str) or not source_branch.strip():
            raise ValueError("Source branch is required")

        source_branch = source_branch.strip()

        if source_branch == target_branch:
            raise ValueError("Cannot compare a branch with itself")

        target_parent = self.branch_engine.get_branch_commit(target_branch)
        source_parent = self.branch_engine.get_branch_commit(source_branch)

        if not target_parent or not source_parent:
            raise ValueError("Both branches must have commits")

        base_id = self.find_common_ancestor(target_parent, source_parent)

        if not base_id:
            raise ValueError("Cannot merge unrelated branch histories")

        base_snapshot = self.commit_engine.get_snapshot(base_id)
        target_snapshot = self.commit_engine.get_snapshot(target_parent)
        source_snapshot = self.commit_engine.get_snapshot(source_parent)

        result = self.merge_snapshots(
            base_snapshot, target_snapshot, source_snapshot
        )

        return {
            "status": "conflict" if result["conflicts"] else "clean",
            "target_branch": target_branch,
            "source_branch": source_branch,
            "target_parent": target_parent,
            "source_parent": source_parent,
            "base_commit": base_id,
            "conflicts": result["conflicts"]
        }

    def resolve_conflicts(self, source_branch, resolved_files, message=None):
        if self.object_store is None:
            raise ValueError("Object storage is not configured")

        if not isinstance(resolved_files, dict) or not resolved_files:
            raise ValueError("Resolved files are required")

        details = self.get_conflict_details(source_branch)

        if details["status"] != "conflict":
            raise ValueError("There are no conflicts to resolve")

        conflict_paths = {item["path"] for item in details["conflicts"]}

        if set(resolved_files) != conflict_paths:
            raise ValueError(
                "Resolved files must contain exactly the conflicting paths"
            )

        for path, content in resolved_files.items():
            if (
                not isinstance(path, str)
                or not path.strip()
                or path.startswith("/")
                or "\\" in path
                or any(part in ("", ".", "..") for part in path.split("/"))
                or not isinstance(content, str)
            ):
                raise ValueError("Invalid resolved file path or content")

        target_branch = details["target_branch"]
        source_branch = details["source_branch"]
        target_parent = details["target_parent"]
        source_parent = details["source_parent"]

        if (
            self.branch_engine.get_branch_commit(target_branch) != target_parent
            or self.branch_engine.get_branch_commit(source_branch) != source_parent
        ):
            raise ValueError("Branch history changed. Refresh conflict details.")

        base_snapshot = self.commit_engine.get_snapshot(details["base_commit"])
        source_snapshot = self.commit_engine.get_snapshot(source_parent)
        snapshot = self.commit_engine.get_snapshot(target_parent)

        # Include non-conflicting changes from the source branch.
        for path in set(base_snapshot) | set(source_snapshot):
            if path in conflict_paths:
                continue

            if base_snapshot.get(path) != source_snapshot.get(path):
                if path in source_snapshot:
                    snapshot[path] = source_snapshot[path]
                else:
                    snapshot.pop(path, None)

        # Store the manually resolved contents.
        for path, content in resolved_files.items():
            snapshot[path] = self.object_store.store_object(content)

        if not isinstance(message, str) or not message.strip():
            message = f"Merge branch '{source_branch}' into '{target_branch}'"

        commit_data = {
            "message": message.strip(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "parent": target_parent,
            "second_parent": source_parent,
            "branch": target_branch,
            "source_branch": source_branch,
            "files": {},
            "deleted_files": [],
            "snapshot": snapshot,
            "is_merge": True,
            "conflicts_resolved": sorted(conflict_paths)
        }

        content = json.dumps(commit_data, sort_keys=True).encode("utf-8")
        commit_id = hashlib.sha256(content).hexdigest()
        commit = {"commit_id": commit_id, **commit_data}

        commits = self.commit_engine.get_commits()
        commits.append(commit)
        self.commit_engine.save_commits(commits)
        self.branch_engine.update_branch_commit(commit_id)

        return {
            "status": "merged",
            "message": "Conflicts resolved and branches merged successfully",
            "branch": target_branch,
            "source_branch": source_branch,
            "commit_id": commit_id,
            "files": snapshot,
            "conflicts_resolved": sorted(conflict_paths)
        }

    def merge_branches(self, source_branch, message=None):
        target_branch = self.branch_engine.get_current_branch()

        if not isinstance(source_branch, str) or not source_branch.strip():
            raise ValueError("Source branch is required")

        source_branch = source_branch.strip()

        if source_branch == target_branch:
            raise ValueError("Cannot merge a branch into itself")

        target_parent = self.branch_engine.get_branch_commit(
            target_branch
        )
        source_parent = self.branch_engine.get_branch_commit(
            source_branch
        )

        if target_parent == source_parent:
            return {
                "status": "up_to_date",
                "message": "Branches are already up to date",
                "branch": target_branch
            }

        commits = self.commit_engine.get_commits()
        lookup = {
            commit["commit_id"]: commit
            for commit in commits
        }

        target_ancestors = self._get_ancestors(
            target_parent, lookup
        )
        source_ancestors = self._get_ancestors(
            source_parent, lookup
        )

        # Source is already included in target history.
        if source_parent and source_parent in target_ancestors:
            return {
                "status": "up_to_date",
                "message": "Target branch already contains source changes",
                "branch": target_branch
            }

        # Target is an ancestor of source: fast-forward.
        if target_parent is None or target_parent in source_ancestors:
            if source_parent is None:
                return {
                    "status": "up_to_date",
                    "branch": target_branch
                }

            self.branch_engine.update_branch_commit(source_parent)

            return {
                "status": "fast_forward",
                "message": "Branch fast-forwarded successfully",
                "branch": target_branch,
                "source_branch": source_branch,
                "commit_id": source_parent,
                "files": self.commit_engine.get_snapshot(source_parent)
            }

        base_id = self.find_common_ancestor(
            target_parent, source_parent
        )

        if base_id is None:
            raise ValueError("Cannot merge unrelated branch histories")

        base_snapshot = self.commit_engine.get_snapshot(base_id)
        target_snapshot = self.commit_engine.get_snapshot(target_parent)
        source_snapshot = self.commit_engine.get_snapshot(source_parent)

        result = self.merge_snapshots(
            base_snapshot,
            target_snapshot,
            source_snapshot
        )

        if not result["success"]:
            return {
                "status": "conflict",
                "message": "Merge conflicts must be resolved",
                "branch": target_branch,
                "source_branch": source_branch,
                "conflicts": result["conflicts"]
            }

        if message is None:
            message = f"Merge branch '{source_branch}' into '{target_branch}'"

        commit = self._create_merge_commit(
            message,
            target_branch,
            target_parent,
            source_parent,
            result["merged_snapshot"]
        )

        return {
            "status": "merged",
            "message": "Branches merged successfully",
            "branch": target_branch,
            "source_branch": source_branch,
            "commit_id": commit["commit_id"],
            "files": result["merged_snapshot"]
        }
