from typing import TypedDict, List
from pydantic import BaseModel, Field


class Sprint(BaseModel):
    """One Scrum sprint — structured output target for planner_node."""
    number: int = Field(description="Sprint number, starting from 1")
    goal: str = Field(description="One-sentence sprint goal")
    user_stories: List[str] = Field(
        description="3-5 user stories in 'As a ... I want ... so that ...' format"
    )
    technical_tasks: List[str] = Field(
        description="3-7 concrete technical implementation tasks"
    )
    definition_of_done: List[str] = Field(
        description="3-5 criteria. At least one MUST be browser-testable (e.g., 'Navigate to X, see Y')"
    )


class SprintPlan(BaseModel):
    """Top-level structured output: a list of Sprints."""
    sprints: List[Sprint] = Field(
        description="2-6 sprints covering the full project scope"
    )


class SprintState(TypedDict):
    project_md: str
    sprints: List[dict]   # List[Sprint.model_dump()] — appended by planner_node
    status: str           # planning | done
