from core.repository_engine import RepositoryEngine
from core.object_store import ObjectStore
from core.staging import StagingArea
from core.commit_engine import CommitEngine

repository_id = "forgex-demo-002"
repository_path = f"storage/repositories/{repository_id}"

repository_engine = RepositoryEngine()

repository_engine.initialize_repository(
    repository_id,
    "Second Demo Repository"
)

store = ObjectStore(f"{repository_path}/objects")
staging = StagingArea(f"{repository_path}/metadata")
commits = CommitEngine(f"{repository_path}/metadata")

print("\n--- REPOSITORY ISOLATION TEST ---")
print("Repository:", repository_id)
print("Initial commits:", len(commits.get_commits()))
print("Initial staged files:", staging.get_staged_files())

print("\nFirst repository commits:",
      len(CommitEngine(
          "storage/repositories/forgex-demo-001/metadata"
      ).get_commits()))

print("\nRepository Isolation Test Successful!")
