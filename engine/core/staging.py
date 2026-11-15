import json
import re
from pathlib import Path, PurePosixPath

from core.branch_engine import BranchEngine
from core.object_store import SHA256_PATTERN


class StagingArea:

    def __init__(self, metadata_path="engine/storage/metadata"):
        self.metadata_path = Path(metadata_path)
        self.metadata_path.mkdir(parents=True, exist_ok=True)

        self.branch_engine = BranchEngine(self.metadata_path)
        self.current_branch = self.branch_engine.get_current_branch()

        if self.current_branch == "main":
            prefix = ""
        else:
            prefix = f"-{self.current_branch}"

        self.staging_file = self.metadata_path / f"staging{prefix}.json"
        self.deletions_file = self.metadata_path / f"deletions{prefix}.json"

        if not self.staging_file.exists():
            self.save_staged_files({})

        if not self.deletions_file.exists():
            self.save_deleted_files([])

    def _validate_file_path(self, file_path):
        if not isinstance(file_path, str) or not file_path.strip():
            raise ValueError("A valid file path is required")

        if "\\" in file_path:
            raise ValueError("File paths must use forward slashes")

        path = PurePosixPath(file_path)

        if path.is_absolute() or any(
            part in ("", ".", "..") for part in file_path.split("/")
        ):
            raise ValueError("Invalid file path")

        if not re.fullmatch(r"[A-Za-z0-9._/-]+", file_path):
            raise ValueError("File path contains invalid characters")

        return file_path

    def save_staged_files(self, staged_files):
        with open(self.staging_file, "w", encoding="utf-8") as file:
            json.dump(staged_files, file, indent=4)

    def get_staged_files(self):
        with open(self.staging_file, "r", encoding="utf-8") as file:
            return json.load(file)

    def save_deleted_files(self, deleted_files):
        with open(self.deletions_file, "w", encoding="utf-8") as file:
            json.dump(deleted_files, file, indent=4)

    def get_deleted_files(self):
        with open(self.deletions_file, "r", encoding="utf-8") as file:
            return json.load(file)

    def stage_file(self, file_path, object_hash):
        file_path = self._validate_file_path(file_path)

        if not isinstance(object_hash, str):
            raise ValueError("Invalid object hash")

        if not SHA256_PATTERN.fullmatch(object_hash):
            raise ValueError("Object hash must be a valid SHA-256 hash")

        staged_files = self.get_staged_files()
        staged_files[file_path] = object_hash.lower()
        self.save_staged_files(staged_files)

        deleted_files = self.get_deleted_files()

        if file_path in deleted_files:
            deleted_files.remove(file_path)
            self.save_deleted_files(deleted_files)

        return staged_files

    def stage_delete(self, file_path):
        file_path = self._validate_file_path(file_path)

        staged_files = self.get_staged_files()
        staged_files.pop(file_path, None)
        self.save_staged_files(staged_files)

        deleted_files = self.get_deleted_files()

        if file_path not in deleted_files:
            deleted_files.append(file_path)
            self.save_deleted_files(deleted_files)

        return deleted_files

    def unstage_file(self, file_path):
        file_path = self._validate_file_path(file_path)

        staged_files = self.get_staged_files()
        staged_files.pop(file_path, None)
        self.save_staged_files(staged_files)

        return staged_files

    def unstage_delete(self, file_path):
        file_path = self._validate_file_path(file_path)

        deleted_files = self.get_deleted_files()

        if file_path in deleted_files:
            deleted_files.remove(file_path)

        self.save_deleted_files(deleted_files)
        return deleted_files

    def clear_staging_area(self):
        self.save_staged_files({})
        self.save_deleted_files([])
