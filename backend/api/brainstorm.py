from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
import json

from agents.brainstorm import graph
from models.brainstorm_state import BrainstormState

router = APIRouter()

MAX_MESSAGES = 50  # Defensive cap — AI-SPEC.md Section 4b context window strategy


class Message(BaseModel):
    role: str
    content: str


class BrainstormRequest(BaseModel):
    conversation: List[Message]


@router.post("/api/brainstorm")
async def brainstorm_endpoint(req: BrainstormRequest):
    """SSE endpoint. Runs LangGraph graph, yields one event per node, ends with [DONE].

    Truncates conversation to MAX_MESSAGES before graph invocation.
    Wraps graph execution in try/except — SSE error event + [DONE] on failure.
    Never closes the stream without emitting [DONE]. (AI-SPEC.md Section 6 — SSE completeness)
    """
    # Defensive truncation at the API layer — not inside the graph (AI-SPEC.md Section 4b)
    conversation = [m.model_dump() for m in req.conversation[-MAX_MESSAGES:]]

    init_state = BrainstormState(
        conversation=conversation,
        extracted={},
        missing_fields=[],
        project_md="",
        status="extracting",
    )

    async def event_stream():
        try:
            # stream_mode="updates" yields only changed keys per node — not full state blob
            # (RESEARCH.md Pitfall 5 — must use "updates" not "values")
            async for event in graph.astream(init_state, stream_mode="updates"):
                node_name = list(event.keys())[0]
                data = list(event.values())[0]
                yield f"data: {json.dumps({'node': node_name, 'data': data})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'node': 'error', 'data': {'reason': str(e)}})}\n\n"
        finally:
            # Always emit [DONE] — even if graph raised an exception (AI-SPEC.md Section 6)
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
