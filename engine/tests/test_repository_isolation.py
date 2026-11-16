import tempfile
import unittest
from pathlib import Path

from core.repository_engine import RepositoryEngine
from core.object_store import ObjectStore
from core.staging import StagingArea
from core.commit_engine import CommitEngine


class RepositoryIsolationTests(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.storage = Path(self.temp_dir.name) / "repositories"
        self.engine = RepositoryEngine(self.storage)

        self.engine.initialize_repository("repo-alpha", "Alpha")
        self.engine.initialize_repository("repo-beta", "Beta")

        self.alpha = self.storage / "repo-alpha"
        self.beta = self.storage / "repo-beta"

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_staging_is_isolated_between_repositories(self):
        alpha_store = ObjectStore(str(self.alpha / "objects"))
        alpha_staging = StagingArea(str(self.alpha / "metadata"))
        beta_staging = StagingArea(str(self.beta / "metadata"))

        object_hash = alpha_store.store_object("Alpha repository content")
        alpha_staging.stage_file("alpha.txt", object_hash)

        self.assertIn("alpha.txt", alpha_staging.get_staged_files())
        self.assertEqual(beta_staging.get_staged_files(), {})

    def test_commit_history_is_isolated_between_repositories(self):
        alpha_commits = CommitEngine(str(self.alpha / "metadata"))
        beta_commits = CommitEngine(str(self.beta / "metadata"))

        self.assertEqual(alpha_commits.get_commits(), [])
        self.assertEqual(beta_commits.get_commits(), [])


if __name__ == "__main__":
    unittest.main()
