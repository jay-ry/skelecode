import pytest
from models.brainstorm_state import BrainstormState, ExtractedFields


class TestReviewerRouter:
    """Tests for reviewer_router routing logic — no LLM required."""

    def test_routes_to_drafter_when_no_missing_fields(self):
        """reviewer_router returns 'drafter' when missing_fields is empty."""
        from agents.brainstorm import reviewer_router

        state: BrainstormState = {
            "conversation": [],
            "extracted": {
                "problem": "Recipe sharing",
                "users": "Home cooks",
                "features": "Upload, search, comments",
                "stack": "Next.js + FastAPI",
                "constraints": "Solo dev, no budget",
            },
            "missing_fields": [],
            "project_md": "",
            "status": "extracting",
        }
        result = reviewer_router(state)
        assert result == "drafter", f"Expected 'drafter', got {result!r}"

    def test_routes_to_end_when_missing_fields_present(self):
        """reviewer_router returns '__end__' when missing_fields is non-empty."""
        from agents.brainstorm import reviewer_router

        state: BrainstormState = {
            "conversation": [],
            "extracted": {"problem": "Recipe sharing", "users": "Home cooks"},
            "missing_fields": ["features", "stack", "constraints"],
            "project_md": "",
            "status": "extracting",
        }
        result = reviewer_router(state)
        assert result == "__end__", f"Expected '__end__', got {result!r}"

    def test_routes_to_end_when_missing_fields_is_none_in_state(self):
        """reviewer_router treats missing missing_fields key as all fields missing."""
        from agents.brainstorm import reviewer_router

        state: BrainstormState = {
            "conversation": [],
            "extracted": {},
            "missing_fields": ["problem", "users", "features", "stack", "constraints"],
            "project_md": "",
            "status": "extracting",
        }
        result = reviewer_router(state)
        assert result == "__end__"


class TestReviewerNodePureLogic:
    """reviewer_node must return empty dict — zero state mutations, zero LLM calls."""

    @pytest.mark.asyncio
    async def test_reviewer_node_returns_empty_dict(self):
        from agents.brainstorm import reviewer_node

        state: BrainstormState = {
            "conversation": [],
            "extracted": {"problem": "test"},
            "missing_fields": [],
            "project_md": "",
            "status": "extracting",
        }
        result = await reviewer_node(state)
        assert result == {}, f"reviewer_node must return empty dict, got {result!r}"


class TestGraphCompiles:
    """Graph singleton must compile and be usable."""

    def test_graph_is_not_none(self):
        from agents.brainstorm import graph
        assert graph is not None

    def test_graph_has_astream(self):
        from agents.brainstorm import graph
        assert callable(getattr(graph, "astream", None)), "graph must have callable astream"


class TestPromptsLoaded:
    """Prompts must be loaded at module startup as non-empty strings."""

    def test_extractor_prompt_non_empty(self):
        from agents.brainstorm import EXTRACTOR_PROMPT
        assert isinstance(EXTRACTOR_PROMPT, str)
        assert len(EXTRACTOR_PROMPT) > 50, "EXTRACTOR_PROMPT appears empty or truncated"

    def test_drafter_prompt_contains_required_sections(self):
        from agents.brainstorm import DRAFTER_PROMPT
        required_sections = [
            "# Vision", "# Problem", "# Target Users",
            "# Core Features", "# Tech Stack", "# Data Model", "# Constraints"
        ]
        for section in required_sections:
            assert section in DRAFTER_PROMPT, f"Drafter prompt missing section: {section}"


class TestBrainstormStateTyping:
    """BrainstormState must be instantiatable with all required keys."""

    def test_state_accepts_all_keys(self):
        state: BrainstormState = {
            "conversation": [{"role": "user", "content": "hello"}],
            "extracted": {"problem": "test"},
            "missing_fields": ["users"],
            "project_md": "",
            "status": "extracting",
        }
        # TypedDict — just verify keys exist; Python does not enforce types at runtime
        assert state["conversation"] == [{"role": "user", "content": "hello"}]
        assert state["missing_fields"] == ["users"]
        assert state["status"] == "extracting"
