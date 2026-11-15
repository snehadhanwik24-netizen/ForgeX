import json
import re
from pathlib import Path


class BranchEngine:

    def __init__(self, metadata_path):
        self.metadata_path = Path(metadata_path)
        self.metadata_path.mkdir(parents=True, exist_ok=True)

        self.branches_file = self.metadata_path / "branches.json"
        self.current_branch_file = self.metadata_path / "HEAD"

        if not self.branches_file.exists():
            self._save_branches({"main": None})

        if not self.current_branch_file.exists():
            self._save_current_branch("main")

    def _load_branches(self):
        with open(self.branches_file, "r", encoding="utf-8") as file:
            return json.load(file)

    def _save_branches(self, branches):
        with open(self.branches_file, "w", encoding="utf-8") as file:
            json.dump(branches, file, indent=4)

    def _load_current_branch(self):
        with open(self.current_branch_file, "r", encoding="utf-8") as file:
            return file.read().strip()

    def _save_current_branch(self, branch_name):
        with open(self.current_branch_file, "w", encoding="utf-8") as file:
            file.write(branch_name)

    def get_current_branch(self):
        return self._load_current_branch()

    def _validate_branch_name(self, branch_name):
        if not isinstance(branch_name, str):
            raise ValueError("Branch name must be a string")

        branch_name = branch_name.strip()

        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,99}", branch_name):
            raise ValueError("Invalid branch name")

        return branch_name

    def get_branch_commit(self, branch_name=None):
        branches = self._load_branches()

        if branch_name is None:
            branch_name = self._load_current_branch()

        if branch_name not in branches:
            raise ValueError("Branch does not exist")

        return branches[branch_name]

    def create_branch(self, branch_name):
        branch_name = self._validate_branch_name(branch_name)
        branches = self._load_branches()

        if branch_name in branches:
            raise ValueError("Branch already exists")

        current_branch = self._load_current_branch()
        branches[branch_name] = branches[current_branch]

        self._save_branches(branches)

        return {
            "branch_name": branch_name,
            "commit_id": branches[branch_name],
            "created": True
        }

    def list_branches(self):
        branches = self._load_branches()
        current_branch = self._load_current_branch()

        return [
            {
                "name": name,
                "commit_id": commit_id,
                "current": name == current_branch
            }
            for name, commit_id in branches.items()
        ]

    def switch_branch(self, branch_name):
        branch_name = self._validate_branch_name(branch_name)
        branches = self._load_branches()

        if branch_name not in branches:
            raise ValueError("Branch does not exist")

        self._save_current_branch(branch_name)

        return {
            "current_branch": branch_name,
            "switched": True
        }

    def update_branch_commit(self, commit_id):
        branches = self._load_branches()
        current_branch = self._load_current_branch()

        if current_branch not in branches:
            raise ValueError("Current branch does not exist")

        branches[current_branch] = commit_id
        self._save_branches(branches)

        return branches
