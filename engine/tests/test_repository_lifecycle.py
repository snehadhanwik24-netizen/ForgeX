import tempfile
import unittest
from pathlib import Path

from core.repository_engine import RepositoryEngine


class RepositoryLifecycleTests(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.storage = Path(self.temp_dir.name) / "repositories"
        self.engine = RepositoryEngine(self.storage)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_repository_initializes_successfully(self):
        result = self.engine.initialize_repository(
            "test-repository",
            "Temporary Test Repository"
        )

        self.assertTrue(result["initialized"])
        self.assertEqual(result["repository_id"], "test-repository")
        self.assertTrue(
            (self.storage / "test-repository" / "objects").is_dir()
        )
        self.assertTrue(
            (self.storage / "test-repository" / "metadata").is_dir()
        )

    def test_repository_can_be_retrieved(self):
        self.engine.initialize_repository(
            "retrieve-test",
            "Retrieve Test"
        )

        result = self.engine.get_repository("retrieve-test")

        self.assertEqual(result["repository_name"], "Retrieve Test")

    def test_duplicate_repository_is_rejected(self):
        self.engine.initialize_repository(
            "duplicate-test",
            "Duplicate Test"
        )

        with self.assertRaises(FileExistsError):
            self.engine.initialize_repository(
                "duplicate-test",
                "Duplicate Test Again"
            )


if __name__ == "__main__":
    unittest.main()
