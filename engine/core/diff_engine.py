import difflib


class DiffEngine:

    def compare_content(self, old_content, new_content):

        old_lines = old_content.splitlines()
        new_lines = new_content.splitlines()

        diff = difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile="Previous Version",
            tofile="Current Version",
            lineterm=""
        )

        return list(diff)

    def compare_objects(self, old_hash, new_hash, object_store):

        old_content = object_store.read_object(old_hash)
        new_content = object_store.read_object(new_hash)

        return self.compare_content(
            old_content.decode("utf-8"),
            new_content.decode("utf-8")
        )
