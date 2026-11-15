import hashlib
import re
from pathlib import Path


SHA256_PATTERN = re.compile(r"^[a-fA-F0-9]{64}$")


class ObjectStore:

    def __init__(self, storage_path="engine/storage/objects"):
        self.storage_path = Path(storage_path).resolve()
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def calculate_hash(self, content):
        if isinstance(content, str):
            content = content.encode("utf-8")

        if not isinstance(content, bytes):
            raise TypeError("Object content must be a string or bytes")

        return hashlib.sha256(content).hexdigest()

    def _validate_object_hash(self, object_hash):

        if not isinstance(object_hash, str):
            raise ValueError("Invalid object hash")

        if not SHA256_PATTERN.fullmatch(object_hash):
            raise ValueError("Object hash must be a valid SHA-256 hash")

        return object_hash.lower()

    def _get_object_path(self, object_hash):

        valid_hash = self._validate_object_hash(object_hash)

        object_path = (self.storage_path / valid_hash).resolve()

        if object_path.parent != self.storage_path:
            raise ValueError("Object path is outside storage directory")

        return object_path

    def store_object(self, content):

        if isinstance(content, str):
            content = content.encode("utf-8")

        if not isinstance(content, bytes):
            raise TypeError("Object content must be a string or bytes")

        object_hash = self.calculate_hash(content)
        object_path = self._get_object_path(object_hash)

        if not object_path.exists():
            object_path.write_bytes(content)

        return object_hash

    def read_object(self, object_hash):

        object_path = self._get_object_path(object_hash)

        if not object_path.is_file():
            raise FileNotFoundError("Object not found")

        return object_path.read_bytes()
