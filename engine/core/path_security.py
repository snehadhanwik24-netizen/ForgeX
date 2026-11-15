import re
from pathlib import Path


REPOSITORY_ID_PATTERN = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$"
)


def validate_repository_id(repository_id):
    """
    Validate repository IDs before using them in filesystem paths.
    Supports MongoDB IDs and existing ForgeX test IDs.
    """

    if not isinstance(repository_id, str):
        raise ValueError("Repository ID must be a string")

    if not REPOSITORY_ID_PATTERN.fullmatch(repository_id):
        raise ValueError("Invalid repository ID")

    if repository_id in {".", ".."}:
        raise ValueError("Invalid repository ID")

    return repository_id


def safe_repository_path(storage_root, repository_id):
    """
    Resolve a repository directory and ensure it stays
    directly inside the configured storage directory.
    """

    validate_repository_id(repository_id)

    root = Path(storage_root).resolve()
    repository_path = (root / repository_id).resolve()

    if repository_path.parent != root:
        raise ValueError("Repository path is outside storage directory")

    return repository_path
