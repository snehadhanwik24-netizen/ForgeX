import json
import shutil
from pathlib import Path

from core.branch_engine import BranchEngine
from core.path_security import safe_repository_path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_STORAGE_PATH = PROJECT_ROOT / "storage" / "repositories"


class RepositoryEngine:

    def __init__(self, storage_path=None):
        if storage_path is None:
            self.storage_path = DEFAULT_STORAGE_PATH.resolve()
        else:
            self.storage_path = Path(storage_path).resolve()

        self.storage_path.mkdir(parents=True, exist_ok=True)

    def initialize_repository(self, repository_id, repository_name):

        repository_path = safe_repository_path(
            self.storage_path,
            repository_id
        )

        if repository_path.exists():
            raise FileExistsError("Repository already initialized")

        objects_path = repository_path / "objects"
        metadata_path = repository_path / "metadata"

        objects_path.mkdir(parents=True)
        metadata_path.mkdir(parents=True)

        config = {
            "repository_id": repository_id,
            "repository_name": repository_name,
            "initialized": True
        }

        with open(
            repository_path / "config.json",
            "w",
            encoding="utf-8"
        ) as file:
            json.dump(config, file, indent=4)

        with open(
            metadata_path / "commits.json",
            "w",
            encoding="utf-8"
        ) as file:
            json.dump([], file)

        with open(
            metadata_path / "staging.json",
            "w",
            encoding="utf-8"
        ) as file:
            json.dump({}, file)

        BranchEngine(metadata_path)

        return config

    def get_repository(self, repository_id):

        repository_path = safe_repository_path(
            self.storage_path,
            repository_id
        )

        config_path = repository_path / "config.json"

        if not config_path.exists():
            raise FileNotFoundError("Repository not initialized")

        with open(config_path, "r", encoding="utf-8") as file:
            return json.load(file)

    def delete_repository(self, repository_id):

        repository_path = safe_repository_path(
            self.storage_path,
            repository_id
        )

        if not repository_path.exists():
            return {
                "repository_id": repository_id,
                "deleted": False,
                "message": "Repository storage does not exist"
            }

        if not repository_path.is_dir():
            raise ValueError("Repository storage path is not a directory")

        shutil.rmtree(repository_path)

        return {
            "repository_id": repository_id,
            "deleted": True,
            "message": "Repository storage deleted successfully"
        }
