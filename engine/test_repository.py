from core.repository_engine import RepositoryEngine

engine = RepositoryEngine()

repository = engine.initialize_repository(
    "forgex-demo-001",
    "ForgeX Demo Repository"
)

print("\n--- FORGEX REPOSITORY INITIALIZATION ---")
print("Repository ID:", repository["repository_id"])
print("Repository Name:", repository["repository_name"])
print("Initialized:", repository["initialized"])

print("\n--- VERIFY REPOSITORY ---")

result = engine.get_repository("forgex-demo-001")

print("Repository Retrieved:", result["repository_name"])

print("\nRepository Initialization Successful!")
