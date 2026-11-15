from core.object_store import ObjectStore
from core.staging import StagingArea
from core.commit_engine import CommitEngine

store = ObjectStore()
staging = StagingArea()
commit_engine = CommitEngine()

file_path = "README.md"

content = """# ForgeX
My custom version control platform.

Features:
- SHA-256 Object Storage
- File Staging
- Commit Management
"""

object_hash = store.store_object(content)

staging.stage_file(file_path, object_hash)

commit = commit_engine.create_commit(
    "Added ForgeX feature documentation",
    staging.get_staged_files()
)

staging.clear_staging_area()

print("\n--- SECOND COMMIT ---")
print("Commit Message:", commit["message"])
print("Commit ID:", commit["commit_id"])
print("Parent Commit:", commit["parent"])

print("\n--- COMPLETE COMMIT HISTORY ---")

for item in commit_engine.get_history():
    print(item["commit_id"], "-", item["message"])

print("\nSecond Commit Test Successful!")
