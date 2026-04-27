from typing import TypedDict, List


class SprintState(TypedDict):
    project_md: str
    sprints: List[dict]   # [{number: int, goal: str, content_md: str}, ...]
    status: str           # planning | done
