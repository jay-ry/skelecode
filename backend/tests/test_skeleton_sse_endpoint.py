import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


@pytest.fixture
def valid_payload():
    return {
        "project_md": "# Vision\nA task tracker.",
        "sprints": [
            {"number": 1, "goal": "Setup", "user_stories": ["As a dev..."],
             "technical_tasks": ["Create project"], "definition_of_done": ["Navigate to / -> renders"]}
        ],
    }


def make_tree_builder_event(folder_tree_str):
    return {"tree_builder": {"file_list": [], "folder_tree": folder_tree_str, "status": "building_wireframe"}}


def make_wireframe_event(html):
    return {"wireframe_builder": {"wireframe_html": html, "status": "done"}}


def make_stack_event(stack):
    return {"stack_resolver": {"tech_stack": stack, "status": "building_tree"}}


class TestSkeletonSSEEndpoint:
    def test_returns_event_stream_content_type(self, client, valid_payload):
        async def mock_astream(state, stream_mode=None):
            yield make_stack_event({"frontend": "Next.js", "backend": "FastAPI", "db": "Neon"})
            yield make_tree_builder_event("├── a.py\n└── b.py")
            yield make_wireframe_event("<!DOCTYPE html><html></html>")

        with patch("api.skeleton.graph") as mock_graph:
            mock_graph.astream = mock_astream
            response = client.post("/api/skeleton", json=valid_payload)

        assert "text/event-stream" in response.headers.get("content-type", "")

    def test_emits_one_tree_line_event_per_line(self, client, valid_payload):
        async def mock_astream(state, stream_mode=None):
            yield make_tree_builder_event("├── a.py\n├── b.py\n└── c.py")
            yield make_wireframe_event("<!DOCTYPE html>x</html>")

        with patch("api.skeleton.graph") as mock_graph:
            mock_graph.astream = mock_astream
            response = client.post("/api/skeleton", json=valid_payload)

        tree_line_frames = [
            line for line in response.text.split("\n")
            if line.startswith("data: ") and '"type": "tree_line"' in line
        ]
        assert len(tree_line_frames) == 3, f"Expected 3 tree_line frames, got {len(tree_line_frames)}"

    def test_emits_exactly_one_wireframe_event(self, client, valid_payload):
        async def mock_astream(state, stream_mode=None):
            yield make_tree_builder_event("└── main.py")
            yield make_wireframe_event("<!DOCTYPE html>ok</html>")

        with patch("api.skeleton.graph") as mock_graph:
            mock_graph.astream = mock_astream
            response = client.post("/api/skeleton", json=valid_payload)

        wireframe_frames = [
            line for line in response.text.split("\n")
            if line.startswith("data: ") and '"type": "wireframe"' in line
        ]
        assert len(wireframe_frames) == 1

    def test_stream_ends_with_done(self, client, valid_payload):
        async def mock_astream(state, stream_mode=None):
            yield make_tree_builder_event("└── main.py")
            yield make_wireframe_event("<!DOCTYPE html>x</html>")

        with patch("api.skeleton.graph") as mock_graph:
            mock_graph.astream = mock_astream
            response = client.post("/api/skeleton", json=valid_payload)

        data_lines = [line for line in response.text.split("\n") if line.startswith("data: ")]
        assert data_lines[-1] == "data: [DONE]"

    def test_done_emitted_even_on_graph_exception(self, client, valid_payload):
        async def failing_astream(state, stream_mode=None):
            raise RuntimeError("Simulated graph failure")
            yield  # unreachable; makes this a generator

        with patch("api.skeleton.graph") as mock_graph:
            mock_graph.astream = failing_astream
            response = client.post("/api/skeleton", json=valid_payload)

        assert "data: [DONE]" in response.text
        assert '"type": "error"' in response.text

    def test_project_md_truncated_to_max_chars(self, client):
        from api.skeleton import MAX_PROJECT_MD_CHARS
        oversized = "x" * (MAX_PROJECT_MD_CHARS + 10_000)
        captured = {}

        async def mock_astream(state, stream_mode=None):
            captured["project_md_len"] = len(state["project_md"])
            captured["sprints_len"] = len(state["sprints"])
            return
            yield

        with patch("api.skeleton.graph") as mock_graph:
            mock_graph.astream = mock_astream
            client.post("/api/skeleton", json={"project_md": oversized, "sprints": []})

        assert captured["project_md_len"] == MAX_PROJECT_MD_CHARS

    def test_sprints_truncated_to_max(self, client):
        from api.skeleton import MAX_SPRINTS
        many_sprints = [{"number": i} for i in range(MAX_SPRINTS + 5)]
        captured = {}

        async def mock_astream(state, stream_mode=None):
            captured["sprints_len"] = len(state["sprints"])
            return
            yield

        with patch("api.skeleton.graph") as mock_graph:
            mock_graph.astream = mock_astream
            client.post("/api/skeleton", json={"project_md": "x", "sprints": many_sprints})

        assert captured["sprints_len"] == MAX_SPRINTS

    def test_event_shape_uses_type_key_not_node_key(self, client, valid_payload):
        """CONTEXT.md locked decision: skeleton events use 'type' key, not 'node' key."""
        async def mock_astream(state, stream_mode=None):
            yield make_tree_builder_event("└── main.py")
            yield make_wireframe_event("<!DOCTYPE html>x</html>")

        with patch("api.skeleton.graph") as mock_graph:
            mock_graph.astream = mock_astream
            response = client.post("/api/skeleton", json=valid_payload)

        assert '"type": "tree_line"' in response.text
        assert '"type": "wireframe"' in response.text
        assert '"node": "tree_line"' not in response.text
        assert '"node": "wireframe"' not in response.text
