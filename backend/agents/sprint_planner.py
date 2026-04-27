from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")

from pathlib import Path
import logging
import re

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END

from models.sprint_state import SprintState

logger = logging.getLogger(__name__)

# Load system prompt at module startup — not inside node (Pitfall 9)
_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
SPRINT_PLANNER_PROMPT = (_PROMPTS_DIR / "sprint_planner_system.txt").read_text()

# Single LLM instance — RAW text output (no with_structured_output)
# temperature=0.4 + max_tokens=8192 per RESEARCH.md Groq Parameters table (D-13)
llm_planner = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.4,
    max_tokens=8192,
)

# Inter-sprint separator — must match the prompt instruction exactly (D-02, D-03)
SPRINT_SEPARATOR_PATTERN = re.compile(r"\n\n---\n\n")
SPRINT_NUMBER_PATTERN = re.compile(r"^#\s+Sprint\s+(\d+)", re.IGNORECASE)
SPRINT_GOAL_PATTERN = re.compile(
    r"##\s+Sprint\s+Goal\s*\n+(.+?)(?:\n|$)", re.IGNORECASE
)


def _parse_sprint_markdown(raw: str) -> list[dict]:
    """Split raw LLM output into per-sprint dicts.

    Returns: list of {number: int, goal: str, content_md: str}.
    Falls back to a single sprint containing the raw text on total parse failure
    (D-04 / CONTEXT.md error-handling discretion).
    """
    chunks = SPRINT_SEPARATOR_PATTERN.split(raw.strip())
    sprints: list[dict] = []
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        num_match = SPRINT_NUMBER_PATTERN.match(chunk)
        sprint_number = int(num_match.group(1)) if num_match else len(sprints) + 1
        goal_match = SPRINT_GOAL_PATTERN.search(chunk)
        goal = goal_match.group(1).strip() if goal_match else ""
        sprints.append({
            "number": sprint_number,
            "goal": goal,
            "content_md": chunk,
        })
    if not sprints:
        logger.warning("sprint_planner: total parse failure, returning raw as sprint 1")
        return [{"number": 1, "goal": "", "content_md": raw.strip()}]
    return sprints


async def planner_node(state: SprintState) -> dict:
    """Generate all sprints from project.md as a single markdown blob.

    Mirrors backend/agents/brainstorm.py drafter_node — raw ainvoke, response.content.
    Splits the blob into per-sprint dicts before returning.
    """
    messages = [
        SystemMessage(content=SPRINT_PLANNER_PROMPT),
        HumanMessage(content=f"Project spec:\n\n{state['project_md']}"),
    ]
    response = await llm_planner.ainvoke(messages)
    sprints = _parse_sprint_markdown(response.content)
    return {"sprints": sprints, "status": "done"}


# Compile once at module import — safe to reuse across concurrent FastAPI requests
builder = StateGraph(SprintState)
builder.add_node("planner", planner_node)
builder.add_edge(START, "planner")
builder.add_edge("planner", END)

graph = builder.compile()
