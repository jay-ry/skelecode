import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient


def make_mock_event(node_name: str, data: dict):
    """Helper — creates an astream() event dict matching real LangGraph output."""
    return {node_name: data}


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


@pytest.fixture
def valid_payload():
    return {
        "conversation": [
            {"role": "user", "content": "I want to build a recipe app"},
            {"role": "assistant", "content": "Who is it for?"},
            {"role": "user", "content": "Home cooks"},
        ]
    }


class TestSSEEndpointResponseFormat:
    """Tests SSE endpoint response headers and stream format."""

    def test_returns_event_stream_content_type(self, client, valid_payload):
        """POST /api/brainstorm must return text/event-stream content type."""
        # Mock graph.astream to return a predictable sequence without LLM calls
        mock_events = [
            make_mock_event("extractor", {"extracted": {"problem": "recipes"}, "missing_fields": [], "status": "extracting"}),
            make_mock_event("reviewer", {}),
            make_mock_event("drafter", {"project_md": "# Vision\ntest", "status": "done"}),
        ]

        async def mock_astream(state, stream_mode=None):
            for event in mock_events:
                yield event

        with patch("api.brainstorm.graph") as mock_graph:
            mock_graph.astream = mock_astream
            response = client.post("/api/brainstorm", json=valid_payload)

        assert "text/event-stream" in response.headers.get("content-type", "")

    def test_stream_ends_with_done_sentinel(self, client, valid_payload):
        """SSE stream must end with 'data: [DONE]' as the last data line."""
        mock_events = [
            make_mock_event("extractor", {"extracted": {}, "missing_fields": ["problem"], "status": "extracting"}),
            make_mock_event("reviewer", {}),
        ]

        async def mock_astream(state, stream_mode=None):
            for event in mock_events:
                yield event

        with patch("api.brainstorm.graph") as mock_graph:
            mock_graph.astream = mock_astream
            response = client.post("/api/brainstorm", json=valid_payload)

        content = response.text
        data_lines = [line for line in content.split("\n") if line.startswith("data: ")]
        assert data_lines[-1] == "data: [DONE]", f"Last SSE line must be [DONE], got: {data_lines[-1]!r}"

    def test_done_emitted_even_on_graph_exception(self, client, valid_payload):
        """[DONE] must be emitted even when graph.astream raises an exception."""
        async def failing_astream(state, stream_mode=None):
            raise RuntimeError("Simulated graph failure")
            yield  # make it an async generator

        with patch("api.brainstorm.graph") as mock_graph:
            mock_graph.astream = failing_astream
            response = client.post("/api/brainstorm", json=valid_payload)

        content = response.text
        assert "data: [DONE]" in content, "Stream must emit [DONE] even on exception"
        assert '"node": "error"' in content, "Error event must appear before [DONE]"

    def test_conversation_truncated_to_max_messages(self, client):
        """Conversations with >50 messages are truncated to last 50."""
        long_conversation = [
            {"role": "user" if i % 2 == 0 else "assistant", "content": f"message {i}"}
            for i in range(60)
        ]
        payload = {"conversation": long_conversation}

        captured_state = {}

        async def mock_astream(state, stream_mode=None):
            captured_state["conversation"] = state["conversation"]
            return
            yield  # make it an async generator

        with patch("api.brainstorm.graph") as mock_graph:
            mock_graph.astream = mock_astream
            client.post("/api/brainstorm", json=payload)

        assert len(captured_state.get("conversation", [])) == 50, (
            f"Expected 50 messages after truncation, got {len(captured_state.get('conversation', []))}"
        )

    def test_node_events_parse_as_json_with_node_key(self, client, valid_payload):
        """Non-[DONE] SSE events must parse as JSON with a 'node' key."""
        mock_events = [
            make_mock_event("extractor", {"extracted": {}, "missing_fields": ["problem"], "status": "extracting"}),
        ]

        async def mock_astream(state, stream_mode=None):
            for event in mock_events:
                yield event

        with patch("api.brainstorm.graph") as mock_graph:
            mock_graph.astream = mock_astream
            response = client.post("/api/brainstorm", json=valid_payload)

        content = response.text
        data_lines = [line for line in content.split("\n") if line.startswith("data: ")]
        # All lines except [DONE] must be valid JSON with "node" key
        for line in data_lines[:-1]:  # exclude last [DONE] line
            payload_str = line[len("data: "):]
            parsed = json.loads(payload_str)
            assert "node" in parsed, f"SSE event missing 'node' key: {parsed}"
