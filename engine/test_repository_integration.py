from core.object_store import ObjectStore
from core.staging import StagingArea
from core.commit_engine import CommitEngine

repository_path = "storage/repositories/forgex-demo-001"

store = ObjectStore(f"{repository_path}/objects")
staging = StagingArea(f"{repository_path}/metadata")
commits = CommitEngine(f"{repository_path}/metadata")

content = "# ForgeX Demo\nRepository-specific version control."

object_hash = store.store_object(content)

staging.stage_file("README.md", object_hash)

commit = commits.create_commit(
    "Initialize repository-specific commit history",
    staging.get_staged_files()
)

staging.clear_staging_area()

print("\n--- REPOSITORY ENGINE INTEGRATION TEST ---")
print("Repository: forgex-demo-001")
print("Object Hash:", object_hash)
print("Commit ID:", commit["commit_id"])
print("Commit Message:", commit["message"])
print("Parent:", commit["parent"])

print("\nRepository Commit History:")

for item in commits.get_history():
    print(item["commit_id"], "-", item["message"])

print("\nRepository Integration Successful!")
