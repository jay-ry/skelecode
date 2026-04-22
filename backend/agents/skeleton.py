from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")

import json
import logging
import re
from pathlib import Path

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END

from models.skeleton_state import SkeletonState
from utils.tree_formatter import format_tree

logger = logging.getLogger(__name__)

# Load prompts at module startup (AI-SPEC Pitfall 9 — never load inside node functions)
_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
STACK_RESOLVER_PROMPT = (_PROMPTS_DIR / "skeleton_stack_resolver_system.txt").read_text()
TREE_BUILDER_PROMPT = (_PROMPTS_DIR / "skeleton_tree_builder_system.txt").read_text()
WIREFRAME_BUILDER_PROMPT = (_PROMPTS_DIR / "skeleton_wireframe_builder_system.txt").read_text()

# One LLM instance per node — per-node temperature (RESEARCH.md Pattern 10)
llm_stack_resolver = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.0,
    max_tokens=512,
)
llm_tree_builder = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.0,
    max_tokens=2048,
)
llm_wireframe_builder = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.5,
    max_tokens=1500,
)

# Defensive default — used when stack_resolver cannot parse LLM output (Pitfall 6)
DEFAULT_STACK = {"frontend": "Next.js", "backend": "FastAPI", "db": "Neon"}

# Fallback wireframe HTML (CONTEXT.md lines 142 — exact string locked)
FALLBACK_WIREFRAME = "<html><body><h1>Sprint 1 wireframe unavailable</h1></body></html>"


def _strip_markdown_fences(text: str) -> str:
    """Strip leading ```html and trailing ``` from LLM output (Pitfall 7 safety net)."""
    stripped = text.strip()
    stripped = re.sub(r"^```(?:html|json)?\s*\n?", "", stripped)
    stripped = re.sub(r"\n?```\s*$", "", stripped)
    return stripped.strip()


async def stack_resolver(state: SkeletonState) -> dict:
    """Extract tech stack dict from project_md. Returns DEFAULT_STACK on parse failure."""
    messages = [
        SystemMessage(content=STACK_RESOLVER_PROMPT),
        HumanMessage(content=f"Project spec:\n\n{state['project_md']}"),
    ]
    try:
        response = await llm_stack_resolver.ainvoke(messages)
        raw = _strip_markdown_fences(response.content if hasattr(response, "content") else str(response))
        tech_stack = json.loads(raw)
        if not isinstance(tech_stack, dict) or not tech_stack.get("frontend"):
            raise ValueError("empty or malformed stack")
    except Exception as e:  # noqa: BLE001
        logger.warning("stack_resolver fell back to DEFAULT_STACK: %s", e)
        tech_stack = dict(DEFAULT_STACK)
    return {"tech_stack": tech_stack, "status": "building_tree"}


async def tree_builder(state: SkeletonState) -> dict:
    """Ask LLM for a JSON file_list, then render as ASCII tree using format_tree."""
    tech_stack = state.get("tech_stack") or DEFAULT_STACK
    messages = [
        SystemMessage(content=TREE_BUILDER_PROMPT),
        HumanMessage(content=f"Stack:\n\n{json.dumps(tech_stack)}"),
    ]
    try:
        response = await llm_tree_builder.ainvoke(messages)
        raw = _strip_markdown_fences(response.content if hasattr(response, "content") else str(response))
        file_list = json.loads(raw)
        if not isinstance(file_list, list):
            raise ValueError("tree_builder did not return a JSON array")
        file_list = [f for f in file_list if isinstance(f, str)]
    except Exception as e:  # noqa: BLE001
        logger.warning("tree_builder fell back to minimal list: %s", e)
        file_list = [
            "frontend/app/page.tsx",
            "frontend/package.json",
            "backend/main.py",
            "backend/requirements.txt",
        ]
    folder_tree = format_tree(file_list)
    return {
        "file_list": file_list,
        "folder_tree": folder_tree,
        "status": "building_wireframe",
    }


async def wireframe_builder(state: SkeletonState) -> dict:
    """Generate Sprint 1 HTML wireframe. Falls back to canned HTML on any failure."""
    sprints = state.get("sprints") or []
    if not sprints:
        return {"wireframe_html": FALLBACK_WIREFRAME, "status": "done"}

    sprint_1 = sprints[0]
    messages = [
        SystemMessage(content=WIREFRAME_BUILDER_PROMPT),
        HumanMessage(content=f"Sprint 1:\n\n{json.dumps(sprint_1)}"),
    ]
    try:
        response = await llm_wireframe_builder.ainvoke(messages)
        raw = response.content if hasattr(response, "content") else str(response)
        html = _strip_markdown_fences(raw)
        if not html.lstrip().startswith("<"):
            raise ValueError("wireframe output is not HTML")
    except Exception as e:  # noqa: BLE001
        logger.warning("wireframe_builder fell back to canned HTML: %s", e)
        html = FALLBACK_WIREFRAME
    return {"wireframe_html": html, "status": "done"}


# Compile graph at module load — 3-node linear (no conditionals)
builder = StateGraph(SkeletonState)
builder.add_node("stack_resolver", stack_resolver)
builder.add_node("tree_builder", tree_builder)
builder.add_node("wireframe_builder", wireframe_builder)
builder.add_edge(START, "stack_resolver")
builder.add_edge("stack_resolver", "tree_builder")
builder.add_edge("tree_builder", "wireframe_builder")
builder.add_edge("wireframe_builder", END)

graph = builder.compile()
