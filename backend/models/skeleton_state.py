from typing import TypedDict, List


class SkeletonState(TypedDict):
    project_md: str
    sprints: List[dict]
    tech_stack: dict           # {frontend: str, backend: str, db: str | None}
    file_list: List[str]       # ["frontend/app/layout.tsx", ...]
    folder_tree: str           # formatted ASCII tree string
    wireframe_html: str        # legacy single-wireframe field (kept for compat)
    wireframe_htmls: List[str] # one HTML string per sprint, in sprint order
    status: str                # resolving | building_tree | building_wireframe | done
