from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")

from pathlib import Path
import logging

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END

from models.sprint_state import SprintState, Sprint, SprintPlan

logger = logging.getLogger(__name__)

# Load system prompt at module startup — not inside node (AI-SPEC.md Pitfall 9 pattern from Phase 1)
_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
SPRINT_PLANNER_PROMPT = (_PROMPTS_DIR / "sprint_planner_system.txt").read_text()

# Single LLM instance — structured output via tool-calling
# AI-SPEC.md Section 4 — Model Configuration
llm_planner = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.3,
    max_tokens=8192,
)

# Do NOT pass method="json_schema" — ChatGroq uses tool-calling (AI-SPEC.md Pitfall 4)
structured_planner = llm_planner.with_structured_output(SprintPlan)


async def planner_node(state: SprintState) -> dict:
    """Generate all sprints from project.md in a single structured LLM call.

    Returns a dict merged into SprintState:
      - sprints: List[dict]  — each dict is Sprint.model_dump()
      - status: "done"

    RESEARCH.md Pattern 2: graph yields ONE event here; the SSE endpoint iterates
    the sprints list to emit one SSE frame per sprint.
    """
    messages = [
        SystemMessage(content=SPRINT_PLANNER_PROMPT),
        HumanMessage(content=f"Project spec:\n\n{state['project_md']}"),
    ]
    result: SprintPlan = await structured_planner.ainvoke(messages)
    return {
        "sprints": [s.model_dump() for s in result.sprints],
        "status": "done",
    }


# Compile once at module import — safe to reuse across concurrent FastAPI requests
builder = StateGraph(SprintState)
builder.add_node("planner", planner_node)
builder.add_edge(START, "planner")
builder.add_edge("planner", END)

graph = builder.compile()
