from typing import TypedDict, List


class SkeletonState(TypedDict):
    project_md: str
    sprints: List[dict]
    tech_stack: dict           # {frontend: str, backend: str, db: str | None}
    file_list: List[str]       # ["frontend/app/layout.tsx", ...]
    folder_tree: str           # formatted ASCII tree string
    wireframe_html: str        # complete HTML string
    status: str                # resolving | building_tree | building_wireframe | done
