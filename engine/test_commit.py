from core.object_store import ObjectStore
from core.staging import StagingArea
from core.commit_engine import CommitEngine

# Initialize components
store = ObjectStore()
staging = StagingArea()
commit_engine = CommitEngine()

# Sample file
file_path = "README.md"
content = "# ForgeX\nMy custom version control platform."

# Store content
object_hash = store.store_object(content)

# Stage file
staged_files = staging.stage_file(file_path, object_hash)

# Create commit
commit = commit_engine.create_commit(
    "Initial ForgeX commit",
    staged_files
)

# Clear staging after successful commit
staging.clear_staging_area()

print("\n--- FORGEX COMMIT CREATED ---")
print("Commit Message:", commit["message"])
print("Commit ID:", commit["commit_id"])
print("Parent:", commit["parent"])
print("Files:", commit["files"])

print("\n--- COMMIT HISTORY ---")

for item in commit_engine.get_history():
    print(item["commit_id"], "-", item["message"])

print("\nCommit Test Successful!")
