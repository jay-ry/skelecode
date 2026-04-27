from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
import json
import logging

from agents.skeleton import graph
from models.skeleton_state import SkeletonState

logger = logging.getLogger(__name__)
router = APIRouter()

# Input caps (CONTEXT.md "Input cap" section — defensive against prompt injection + DoS)
MAX_PROJECT_MD_CHARS = 50_000
MAX_SPRINTS = 6


class SkeletonRequest(BaseModel):
    project_md: str
    sprints: List[dict]


@router.post("/api/skeleton")
async def skeleton_endpoint(req: SkeletonRequest):
    """SSE endpoint. Runs the skeleton LangGraph, yields:
      - one {"type": "tree_line", "line": str} event per line of folder_tree
      - one {"type": "wireframe", "html": str} event when wireframe is ready
      - one {"type": "error", "reason": str} event on exception
    Always ends with data: [DONE]\\n\\n in the finally block (Phase 1 invariant).

    NOTE: Event shape uses `type` key — DIFFERENT from sprint_planner's {"node", "data"}
    shape. This is the locked contract from CONTEXT.md that the frontend depends on.
    """
    init_state = SkeletonState(
        project_md=req.project_md[:MAX_PROJECT_MD_CHARS],
        sprints=req.sprints[:MAX_SPRINTS],
        tech_stack={},
        file_list=[],
        folder_tree="",
        wireframe_html="",
        wireframe_htmls=[],
        status="resolving",
    )

    async def event_stream():
        try:
            # stream_mode="updates" yields {node_name: partial_state_dict} per node.
            # Without this, it defaults to "values" and yields full state per node
            # (RESEARCH.md Anti-Patterns).
            async for event in graph.astream(init_state, stream_mode="updates"):
                node_name = list(event.keys())[0]
                data = list(event.values())[0]

                if node_name == "tree_builder" and data.get("folder_tree"):
                    # format_tree() joined with "\n"; split and emit one frame per line.
                    for line in data["folder_tree"].split("\n"):
                        yield f"data: {json.dumps({'type': 'tree_line', 'line': line})}\n\n"

                elif node_name == "wireframe_builder":
                    for i, html in enumerate(data.get("wireframe_htmls") or []):
                        yield f"data: {json.dumps({'type': 'wireframe', 'sprint_number': i + 1, 'html': html})}\n\n"

        except Exception as e:  # noqa: BLE001
            logger.exception("skeleton endpoint failed")
            yield f"data: {json.dumps({'type': 'error', 'reason': str(e)})}\n\n"
        finally:
            # ALWAYS emit [DONE] — even on exception. (Phase 1 invariant.)
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
