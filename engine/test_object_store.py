from core.object_store import ObjectStore

store = ObjectStore()

content = "Hello ForgeX! My first custom commit."

object_hash = store.store_object(content)

print("\n--- ForgeX Object Store Test ---")
print("Original Content:", content)
print("SHA-256 Hash:", object_hash)

retrieved_content = store.read_object(object_hash)

print("Retrieved Content:", retrieved_content.decode("utf-8"))

print("\nStorage Test Successful!")
