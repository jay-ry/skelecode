import pytest
import json
from unittest.mock import patch
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


@pytest.fixture
def valid_payload():
    return {"project_md": "# Vision\nA recipe sharing app for home cooks."}


def make_mock_planner_event(sprints_list):
    """LangGraph astream(stream_mode='updates') yields {node_name: partial_state}."""
    return {"planner": {"sprints": sprints_list, "status": "done"}}


class TestSprintSSEEndpoint:
    def test_returns_event_stream_content_type(self, client, valid_payload):
        async def mock_astream(state, stream_mode=None):
            yield make_mock_planner_event([
                {"number": 1, "goal": "g1", "user_stories": ["s"], "technical_tasks": ["t"], "definition_of_done": ["Navigate to / -> renders"]}
            ])

        with patch("api.sprint_planner.graph") as mock_graph:
            mock_graph.astream = mock_astream
            response = client.post("/api/sprint-planner", json=valid_payload)

        assert "text/event-stream" in response.headers.get("content-type", "")

    def test_stream_yields_one_frame_per_sprint(self, client, valid_payload):
        mock_sprints = [
            {"number": 1, "goal": "Setup", "user_stories": ["s"], "technical_tasks": ["t"], "definition_of_done": ["Navigate to / -> renders"]},
            {"number": 2, "goal": "Core", "user_stories": ["s"], "technical_tasks": ["t"], "definition_of_done": ["Navigate to /core -> renders"]},
            {"number": 3, "goal": "Polish", "user_stories": ["s"], "technical_tasks": ["t"], "definition_of_done": ["Navigate to /polish -> renders"]},
        ]

        async def mock_astream(state, stream_mode=None):
            yield make_mock_planner_event(mock_sprints)

        with patch("api.sprint_planner.graph") as mock_graph:
            mock_graph.astream = mock_astream
            response = client.post("/api/sprint-planner", json=valid_payload)

        sprint_lines = [
            line for line in response.text.split("\n")
            if line.startswith("data: ") and '"node": "sprint"' in line
        ]
        assert len(sprint_lines) == 3, f"Expected 3 sprint frames, got {len(sprint_lines)}: {sprint_lines}"

    def test_stream_ends_with_done(self, client, valid_payload):
        async def mock_astream(state, stream_mode=None):
            yield make_mock_planner_event([
                {"number": 1, "goal": "g", "user_stories": ["s"], "technical_tasks": ["t"], "definition_of_done": ["Navigate to / -> renders"]}
            ])

        with patch("api.sprint_planner.graph") as mock_graph:
            mock_graph.astream = mock_astream
            response = client.post("/api/sprint-planner", json=valid_payload)

        data_lines = [line for line in response.text.split("\n") if line.startswith("data: ")]
        assert data_lines[-1] == "data: [DONE]"

    def test_done_emitted_even_on_graph_exception(self, client, valid_payload):
        async def failing_astream(state, stream_mode=None):
            raise RuntimeError("Simulated graph failure")
            yield

        with patch("api.sprint_planner.graph") as mock_graph:
            mock_graph.astream = failing_astream
            response = client.post("/api/sprint-planner", json=valid_payload)

        assert "data: [DONE]" in response.text
        assert '"node": "error"' in response.text

    def test_project_md_truncated_to_max_chars(self, client):
        """project_md longer than MAX_PROJECT_MD_CHARS is truncated before graph invocation."""
        from api.sprint_planner import MAX_PROJECT_MD_CHARS
        oversized = "x" * (MAX_PROJECT_MD_CHARS + 10_000)

        captured = {}

        async def mock_astream(state, stream_mode=None):
            captured["project_md_len"] = len(state["project_md"])
            return
            yield

        with patch("api.sprint_planner.graph") as mock_graph:
            mock_graph.astream = mock_astream
            client.post("/api/sprint-planner", json={"project_md": oversized})

        assert captured.get("project_md_len") == MAX_PROJECT_MD_CHARS
