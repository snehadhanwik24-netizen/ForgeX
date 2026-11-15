from core.object_store import ObjectStore
from core.diff_engine import DiffEngine

store = ObjectStore()
diff_engine = DiffEngine()

old_content = """# ForgeX
My custom version control platform.
"""

new_content = """# ForgeX
My custom version control platform.

Features:
- SHA-256 Object Storage
- File Staging
- Commit Management
"""

old_hash = store.store_object(old_content)
new_hash = store.store_object(new_content)

print("\n--- FORGEX DIFF ENGINE TEST ---")

print("\nOriginal File Hash:", old_hash)
print("Updated File Hash:", new_hash)

print("\n--- FILE DIFFERENCES ---")

differences = diff_engine.compare_objects(
    old_hash,
    new_hash,
    store
)

for line in differences:
    print(line)

print("\nDiff Test Successful!")
