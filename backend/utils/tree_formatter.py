"""Pure-Python ASCII tree formatter. No external dependencies.

Used by backend/agents/skeleton.py tree_builder node to render a flat file list
as a human-readable folder tree using box-drawing characters.
"""


def format_tree(file_list: list[str]) -> str:
    """Render a flat file list as an ASCII folder tree.

    Input:  ["frontend/app/layout.tsx", "backend/main.py"]
    Output:
        ├── backend/
        │   └── main.py
        └── frontend/
            └── app/
                └── layout.tsx

    Directories are distinguished by a trailing "/" in the rendered name.
    Empty input returns "".
    """
    if not file_list:
        return ""

    # Step 1: Build nested dict from sorted paths.
    # Directory keys end with "/"; file keys do not. Leaf value is None.
    tree: dict = {}
    for path in sorted(file_list):
        parts = path.split("/")
        node = tree
        for part in parts[:-1]:
            node = node.setdefault(part + "/", {})
        node[parts[-1]] = None

    # Step 2: Recursively render using box-drawing characters.
    lines: list[str] = []

    def render(node: dict, prefix: str = "") -> None:
        items = list(node.items())
        for i, (name, children) in enumerate(items):
            is_last = i == len(items) - 1
            connector = "└── " if is_last else "├── "
            lines.append(prefix + connector + name)
            if children is not None:
                extension = "    " if is_last else "│   "
                render(children, prefix + extension)

    render(tree)
    return "\n".join(lines)
