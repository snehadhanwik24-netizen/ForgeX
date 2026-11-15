from core.object_store import ObjectStore
from core.staging import StagingArea

# Create storage and staging objects
store = ObjectStore()
staging = StagingArea()

# Sample repository file
file_path = "README.md"
content = "# ForgeX\nMy custom version control platform."

# Store file content and generate SHA-256 hash
object_hash = store.store_object(content)

# Add file to staging area
staged_files = staging.stage_file(file_path, object_hash)

print("\n--- ForgeX Staging Test ---")
print("File:", file_path)
print("SHA-256:", object_hash)
print("\nStaged Files:")

for path, file_hash in staged_files.items():
    print(path, "->", file_hash)

print("\nStaging Test Successful!")
