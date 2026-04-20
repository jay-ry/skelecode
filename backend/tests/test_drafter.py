import pytest
from unittest.mock import AsyncMock, patch, MagicMock


REQUIRED_SECTIONS = [
    "## Vision",
    "## Problem",
    "## Target Users",
    "## Core Features",
    "## Tech Stack",
    "## Data Model",
    "## Constraints",
]

SAMPLE_PROJECT_MD = """## Vision
A recipe sharing platform for home cooks.

## Problem
Home cooks have no good way to share family recipes digitally.

## Target Users
Home cooks aged 25-45 who want to preserve and share family recipes.

## Core Features
- Recipe upload with photos: As a user, I can upload a recipe with a photo so others can see it. AC: Photo uploads up to 5MB.
- Recipe search: As a user, I can search by ingredient so I find relevant recipes. AC: Search returns results in < 1s.
- Comments: As a user, I can comment on recipes. AC: Comments appear without page reload.

## Tech Stack
Frontend: Next.js. Backend: FastAPI. Database: PostgreSQL.

## Data Model
- Recipe: id, title, ingredients, steps, photo_url, user_id
- Comment: id, recipe_id, user_id, body, created_at

## Constraints
Solo developer. No budget. 3-month timeline.
"""


class TestDrafterSectionCompleteness:
    """Drafter node must return project_md containing all 7 required section headers."""

    @pytest.mark.asyncio
    async def test_all_7_sections_present_in_drafter_output(self):
        """drafter_node with complete ExtractedFields returns project_md with all 7 headers."""
        from models.brainstorm_state import BrainstormState

        # Mock the LLM response to return a well-formed project.md
        mock_response = MagicMock()
        mock_response.content = SAMPLE_PROJECT_MD

        mock_llm = AsyncMock()
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)

        with patch("agents.brainstorm.llm_drafter", mock_llm):
            from agents.brainstorm import drafter_node

            state: BrainstormState = {
                "conversation": [],
                "extracted": {
                    "problem": "Home cooks have no good way to share family recipes.",
                    "users": "Home cooks aged 25-45.",
                    "features": "Recipe upload, search, comments.",
                    "stack": "Next.js, FastAPI, PostgreSQL.",
                    "constraints": "Solo developer, no budget.",
                },
                "missing_fields": [],
                "project_md": "",
                "status": "drafting",
            }

            result = await drafter_node(state)

        project_md = result.get("project_md", "")
        assert project_md, "drafter_node must return a non-empty project_md"

        missing_sections = [s for s in REQUIRED_SECTIONS if s not in project_md]
        assert not missing_sections, (
            f"project_md is missing required sections: {missing_sections}\n"
            f"Got project_md:\n{project_md[:500]}"
        )

    def test_required_sections_list_has_7_items(self):
        """Sanity check: REQUIRED_SECTIONS constant must list exactly 7 items."""
        assert len(REQUIRED_SECTIONS) == 7, (
            f"REQUIRED_SECTIONS must have 7 items, got {len(REQUIRED_SECTIONS)}"
        )
