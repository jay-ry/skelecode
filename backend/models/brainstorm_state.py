from typing import TypedDict, List, Optional
from pydantic import BaseModel, Field


class ExtractedFields(BaseModel):
    """Structured output from the extractor node.
    All fields are Optional — the LLM may not have enough conversation context yet.
    missing_fields is computed from None values, not returned by the LLM.
    """
    problem: Optional[str] = Field(
        None,
        description="The core problem the project solves, in one or two sentences."
    )
    users: Optional[str] = Field(
        None,
        description="The primary target users — who they are and their key distinguishing trait."
    )
    features: Optional[str] = Field(
        None,
        description="The 3-5 core MVP features as a comma-separated list."
    )
    stack: Optional[str] = Field(
        None,
        description="Preferred tech stack: frontend, backend, database. Use 'undecided' if not mentioned."
    )
    constraints: Optional[str] = Field(
        None,
        description="Budget, timeline, team size, or technical constraints. Use 'none stated' if absent."
    )
    monetization: Optional[str] = Field(
        None,
        description="Pricing model or revenue approach described by the user. "
                    "Return null if not mentioned."
    )
    sprint_count_hint: Optional[str] = Field(
        None,
        description="Rough number of sprints implied by project scope, e.g. '4-6'. "
                    "Return null if not discussed."
    )


class BrainstormState(TypedDict):
    conversation: List[dict]   # [{role: str, content: str}, ...]
    extracted: dict            # populated from ExtractedFields.model_dump(exclude_none=True)
    missing_fields: List[str]  # fields that are still None in ExtractedFields
    project_md: str
    status: str                # extracting | drafting | done
