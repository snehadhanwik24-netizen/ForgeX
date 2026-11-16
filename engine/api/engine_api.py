import sys
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENGINE_ROOT = PROJECT_ROOT / "engine"

sys.path.insert(0, str(ENGINE_ROOT))

from core.repository_engine import RepositoryEngine
from core.path_security import safe_repository_path
from core.object_store import ObjectStore
from core.staging import StagingArea
from core.commit_engine import CommitEngine
from core.branch_engine import BranchEngine
from core.diff_engine import DiffEngine
from core.merge_engine import MergeEngine
from core.history_operations import HistoryOperations


REPOSITORY_STORAGE = PROJECT_ROOT / "storage" / "repositories"


def get_components(repository_id):

    base = safe_repository_path(REPOSITORY_STORAGE, repository_id)

    if not (base / "config.json").is_file():
        raise FileNotFoundError("Repository is not initialized")

    metadata_path = base / "metadata"

    store = ObjectStore(base / "objects")
    staging = StagingArea(metadata_path)
    commits = CommitEngine(metadata_path)
    branches = BranchEngine(metadata_path)

    return store, staging, commits, branches


def verify_staged_objects(store, staged_files):

    if not isinstance(staged_files, dict):
        raise ValueError("Invalid staged files data")

    for file_path, object_hash in staged_files.items():

        if not isinstance(file_path, str) or not file_path.strip():
            raise ValueError("Invalid staged file path")

        content = store.read_object(object_hash)
        actual_hash = store.calculate_hash(content)

        if actual_hash != object_hash.lower():
            raise ValueError(
                f"Object integrity verification failed: {file_path}"
            )

    return True


def execute(request):

    if not isinstance(request, dict):
        raise ValueError("Request must be a JSON object")

    action = request.get("action")
    repository_id = request.get("repository_id")

    if not repository_id:
        raise ValueError("Repository ID is required")

    if action == "init":

        name = request.get("repository_name", repository_id)

        return RepositoryEngine(
            REPOSITORY_STORAGE
        ).initialize_repository(repository_id, name)

    if action == "delete":

        return RepositoryEngine(
            REPOSITORY_STORAGE
        ).delete_repository(repository_id)

    store, staging, commits, branches = get_components(repository_id)

    if action == "stage":

        file_path = request.get("file_path")
        content = request.get("content")

        if not file_path or not isinstance(content, str):
            raise ValueError("File path and string content are required")

        object_hash = store.store_object(content)
        staged_files = staging.stage_file(file_path, object_hash)

        return {
            "message": "File staged successfully",
            "file_path": file_path,
            "object_hash": object_hash,
            "staged_files": staged_files
        }

    if action == "stage_delete":

        file_path = request.get("file_path")

        deleted_files = staging.stage_delete(file_path)

        return {
            "message": "File deletion staged successfully",
            "file_path": file_path,
            "deleted_files": deleted_files
        }

    if action == "staging_status":

        staged_files = staging.get_staged_files()
        deleted_files = staging.get_deleted_files()

        return {
            "staged_files": staged_files,
            "deleted_files": deleted_files,
            "summary": {
                "staged": len(staged_files),
                "deleted": len(deleted_files),
                "total": len(staged_files) + len(deleted_files)
            }
        }

    if action == "unstage_file":

        file_path = request.get("file_path")
        staged_files = staging.unstage_file(file_path)

        return {
            "message": "File unstaged successfully",
            "staged_files": staged_files
        }

    if action == "unstage_delete":

        file_path = request.get("file_path")
        deleted_files = staging.unstage_delete(file_path)

        return {
            "message": "Deletion unstaged successfully",
            "deleted_files": deleted_files
        }
    if action == "commit":

        message = request.get("message", "")
        staged_files = staging.get_staged_files()
        deleted_files = staging.get_deleted_files()

        if not staged_files and not deleted_files:
            raise ValueError("No files or deletions staged for commit")

        verify_staged_objects(store, staged_files)

        commit = commits.create_commit(
            message,
            staged_files,
            deleted_files
        )

        staging.clear_staging_area()

        return commit

    if action == "diff":

        old_commit_id = request.get("old_commit_id")
        new_commit_id = request.get("new_commit_id")
        file_path = request.get("file_path")

        if not all(
            isinstance(value, str) and value.strip()
            for value in (old_commit_id, new_commit_id, file_path)
        ):
            raise ValueError(
                "Both commit IDs and a file path are required"
            )

        all_commits = commits.get_commits()
        commit_ids = {
            commit.get("commit_id")
            for commit in all_commits
        }

        if old_commit_id not in commit_ids or new_commit_id not in commit_ids:
            raise ValueError("One or both commits were not found")

        staging._validate_file_path(file_path)

        old_snapshot = commits.get_snapshot(old_commit_id)
        new_snapshot = commits.get_snapshot(new_commit_id)

        def read_snapshot_file(snapshot):
            object_hash = snapshot.get(file_path)

            if object_hash is None:
                return ""

            content = store.read_object(object_hash)

            if store.calculate_hash(content) != object_hash.lower():
                raise ValueError("Object integrity verification failed")

            try:
                return content.decode("utf-8")
            except UnicodeDecodeError:
                raise ValueError("Diff viewer supports UTF-8 text files only")

        old_content = read_snapshot_file(old_snapshot)
        new_content = read_snapshot_file(new_snapshot)

        return {
            "file_path": file_path,
            "old_commit_id": old_commit_id,
            "new_commit_id": new_commit_id,
            "old_content": old_content,
            "new_content": new_content,
            "diff": DiffEngine().compare_content(
                old_content,
                new_content
            )
        }

    if action == "history":
        return commits.get_history()


    if action == "get_conflict_details":
        if staging.get_staged_files() or staging.get_deleted_files():
            raise ValueError("Commit or unstage pending changes before merging")

        source_branch = request.get("source_branch")
        merge_engine = MergeEngine(commits)

        result = merge_engine.get_conflict_details(source_branch)

        for conflict in result.get("conflicts", []):
            for side in ("base", "target", "source"):
                object_hash = conflict.get(side)

                if object_hash is None:
                    conflict[f"{side}_content"] = None
                    continue

                content = store.read_object(object_hash)

                if store.calculate_hash(content) != object_hash.lower():
                    raise ValueError(
                        f"Object integrity verification failed: {conflict['path']}"
                    )

                try:
                    conflict[f"{side}_content"] = content.decode("utf-8")
                except UnicodeDecodeError:
                    raise ValueError(
                        f"File is not valid UTF-8: {conflict['path']}"
                    )

        return result

    if action == "resolve_conflicts":
        if staging.get_staged_files() or staging.get_deleted_files():
            raise ValueError("Commit or unstage pending changes before merging")

        merge_engine = MergeEngine(commits, store)

        result = merge_engine.resolve_conflicts(
            request.get("source_branch"),
            request.get("resolved_files"),
            request.get("message")
        )

        files = {}

        for file_path, object_hash in result["files"].items():
            content = store.read_object(object_hash)

            if store.calculate_hash(content) != object_hash.lower():
                raise ValueError(
                    f"Object integrity verification failed: {file_path}"
                )

            try:
                files[file_path] = content.decode("utf-8")
            except UnicodeDecodeError:
                raise ValueError(
                    f"File is not valid UTF-8: {file_path}"
                )

        result["files"] = files
        result["file_count"] = len(files)

        return result

    if action == "merge":

        if staging.get_staged_files() or staging.get_deleted_files():
            raise ValueError(
                "Commit or unstage pending changes before merging"
            )

        source_branch = request.get("source_branch")
        message = request.get("message")

        merge_engine = MergeEngine(commits)

        result = merge_engine.merge_branches(
            source_branch,
            message
        )

        if result.get("status") in ("merged", "fast_forward"):
            snapshot = commits.get_snapshot()
            files = {}

            for file_path, object_hash in snapshot.items():
                content = store.read_object(object_hash)

                if store.calculate_hash(content) != object_hash.lower():
                    raise ValueError(
                        f"Object integrity verification failed: {file_path}"
                    )

                try:
                    files[file_path] = content.decode("utf-8")
                except UnicodeDecodeError:
                    raise ValueError(
                        f"File is not valid UTF-8: {file_path}"
                    )

            result["files"] = files
            result["file_count"] = len(files)

        return result
    if action == "get_snapshot":

        snapshot = commits.get_snapshot()
        files = {}

        for file_path, object_hash in snapshot.items():

            content = store.read_object(object_hash)
            actual_hash = store.calculate_hash(content)

            if actual_hash != object_hash.lower():
                raise ValueError(
                    f"Object integrity verification failed: {file_path}"
                )

            try:
                files[file_path] = content.decode("utf-8")
            except UnicodeDecodeError:
                raise ValueError(
                    f"File is not valid UTF-8 text: {file_path}"
                )

        return {
            "branch": branches.get_current_branch(),
            "files": files,
            "file_count": len(files)
        }

    if action == "create_branch":
        return branches.create_branch(request.get("branch_name"))

    if action == "list_branches":
        return branches.list_branches()

    if action == "switch_branch":

        branch_result = branches.switch_branch(
            request.get("branch_name")
        )

        snapshot = commits.get_snapshot()
        files = {}

        for file_path, object_hash in snapshot.items():

            content = store.read_object(object_hash)
            actual_hash = store.calculate_hash(content)

            if actual_hash != object_hash.lower():
                raise ValueError(
                    f"Object integrity verification failed: {file_path}"
                )

            try:
                files[file_path] = content.decode("utf-8")
            except UnicodeDecodeError:
                raise ValueError(
                    f"File is not valid UTF-8 text: {file_path}"
                )

        return {
            "branch": branches.get_current_branch(),
            "files": files,
            "file_count": len(files),
            "message": "Branch switched successfully"
        }

    history_ops = HistoryOperations(commits, store, commits.metadata_path)

    if action in ("revert", "cherry_pick", "create_tag", "list_tags",
                  "create_release", "list_releases"):
        if staging.get_staged_files() or staging.get_deleted_files():
            raise ValueError("Commit or unstage pending changes first")

    if action == "revert":
        result = history_ops.revert(
            request.get("commit_id"),
            request.get("message"),
            request.get("mainline_parent")
        )
        if result.get("status") == "reverted":
            snapshot = commits.get_snapshot(result["commit"]["commit_id"])
            result["files"] = {
                path: store.read_object(object_hash).decode("utf-8")
                for path, object_hash in snapshot.items()
            }
        return result

    if action == "cherry_pick":
        result = history_ops.cherry_pick(
            request.get("commit_id"),
            request.get("message")
        )
        if result.get("status") == "cherry_picked":
            snapshot = commits.get_snapshot(result["commit"]["commit_id"])
            result["files"] = {
                path: store.read_object(object_hash).decode("utf-8")
                for path, object_hash in snapshot.items()
            }
        return result

    if action == "create_tag":
        return history_ops.create_tag(
            request.get("name"),
            request.get("commit_id"),
            request.get("message", "")
        )

    if action == "list_tags":
        return history_ops.list_tags()

    if action == "create_release":
        return history_ops.create_release(
            request.get("title"),
            request.get("tag_name"),
            request.get("description", "")
        )

    if action == "list_releases":
        return history_ops.list_releases()
    raise ValueError("Unsupported action")


def main():

    try:
        request = json.load(sys.stdin)
        result = execute(request)

        print(json.dumps({
            "success": True,
            "data": result
        }))

    except Exception as error:

        print(json.dumps({
            "success": False,
            "message": str(error)
        }))

        sys.exit(1)


if __name__ == "__main__":
    main()
