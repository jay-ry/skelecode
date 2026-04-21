import pytest
from unittest.mock import AsyncMock, patch
from models.sprint_state import SprintState, Sprint, SprintPlan


class TestSprintStateTyping:
    def test_sprint_model_fields(self):
        s = Sprint(
            number=1,
            goal="Ship the login page",
            user_stories=["As a user, I want to log in, so that I can access my data."],
            technical_tasks=["Add POST /api/login"],
            definition_of_done=["Navigate to /login -> form renders"],
        )
        assert s.number == 1
        assert s.user_stories[0].startswith("As a ")

    def test_sprint_plan_accepts_list(self):
        plan = SprintPlan(sprints=[])
        assert plan.sprints == []

    def test_sprint_state_accepts_all_keys(self):
        state: SprintState = {"project_md": "# Vision", "sprints": [], "status": "planning"}
        assert state["project_md"] == "# Vision"
        assert state["status"] == "planning"


class TestPlannerNode:
    """Requires agent module — will import in Task 2."""

    @pytest.mark.asyncio
    async def test_planner_node_returns_sprints_list(self):
        from agents.sprint_planner import planner_node, structured_planner

        fake_plan = SprintPlan(sprints=[
            Sprint(
                number=1,
                goal="Setup",
                user_stories=["As a dev, I want scaffolding, so that I can start."],
                technical_tasks=["Create Next.js app"],
                definition_of_done=["Navigate to / -> page renders"],
            )
        ])

        with patch.object(structured_planner, "ainvoke", new=AsyncMock(return_value=fake_plan)):
            state: SprintState = {"project_md": "# Vision\ntest", "sprints": [], "status": "planning"}
            result = await planner_node(state)

        assert "sprints" in result
        assert isinstance(result["sprints"], list)
        assert len(result["sprints"]) == 1
        assert result["sprints"][0]["number"] == 1
        assert result["status"] == "done"


class TestGraphCompiles:
    def test_graph_is_not_none(self):
        from agents.sprint_planner import graph
        assert graph is not None

    def test_graph_has_astream(self):
        from agents.sprint_planner import graph
        assert callable(getattr(graph, "astream", None))


class TestPromptsLoaded:
    def test_sprint_planner_prompt_non_empty(self):
        from agents.sprint_planner import SPRINT_PLANNER_PROMPT
        assert isinstance(SPRINT_PLANNER_PROMPT, str)
        assert len(SPRINT_PLANNER_PROMPT) > 50

    def test_sprint_planner_prompt_mentions_browser(self):
        from agents.sprint_planner import SPRINT_PLANNER_PROMPT
        assert "browser" in SPRINT_PLANNER_PROMPT.lower()

    def test_sprint_planner_prompt_mentions_count_range(self):
        from agents.sprint_planner import SPRINT_PLANNER_PROMPT
        assert "2-6" in SPRINT_PLANNER_PROMPT or "2 to 6" in SPRINT_PLANNER_PROMPT
