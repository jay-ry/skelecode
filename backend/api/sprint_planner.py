from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

from agents.sprint_planner import graph
from models.sprint_state import SprintState

router = APIRouter()

MAX_PROJECT_MD_CHARS = 50_000  # Defensive cap — RESEARCH.md Security Domain (oversized payload / prompt injection defense)


class SprintPlannerRequest(BaseModel):
    project_md: str


@router.post("/api/sprint-planner")
async def sprint_planner_endpoint(req: SprintPlannerRequest):
    """SSE endpoint. Runs LangGraph planner, yields one event per sprint, ends with [DONE].

    - Truncates project_md to MAX_PROJECT_MD_CHARS before graph invocation.
    - Wraps graph execution in try/except — emits SSE error frame + [DONE] on failure.
    - Never closes the stream without emitting [DONE]. (Phase 1 invariant)
    """
    init_state = SprintState(
        project_md=req.project_md[:MAX_PROJECT_MD_CHARS],
        sprints=[],
        status="planning",
    )

    async def event_stream():
        try:
            # stream_mode="updates" yields {node_name: partial_state_dict} per node.
            # Planner has ONE node — we get ONE event with all sprints (each is
            # {number: int, goal: str, content_md: str} per phase 5 D-03/D-04), then
            # iterate to emit one SSE frame per sprint.
            async for event in graph.astream(init_state, stream_mode="updates"):
                node_name = list(event.keys())[0]
                data = list(event.values())[0]
                if node_name == "planner" and data.get("sprints"):
                    for sprint in data["sprints"]:
                        yield f"data: {json.dumps({'node': 'sprint', 'data': sprint})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'node': 'error', 'data': {'reason': str(e)}})}\n\n"
        finally:
            # Always emit [DONE] — even if graph raised an exception
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
