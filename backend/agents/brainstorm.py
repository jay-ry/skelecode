from dotenv import load_dotenv
load_dotenv()

from pathlib import Path
from typing import Literal
import logging

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END
from pydantic import ValidationError

from models.brainstorm_state import BrainstormState, ExtractedFields

logger = logging.getLogger(__name__)

# Load system prompts at module startup — not inside node functions (AI-SPEC.md Pitfall 9)
_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
EXTRACTOR_PROMPT = (_PROMPTS_DIR / "extractor_system.txt").read_text()
DRAFTER_PROMPT = (_PROMPTS_DIR / "drafter_system.txt").read_text()

# Two separate model instances — extractor is deterministic, drafter is generative
# AI-SPEC.md Section 4 — Model Configuration
llm_extractor = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.0,
    max_output_tokens=1024,
)
llm_drafter = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.7,
    max_output_tokens=4096,
)

# with_structured_output uses Claude's tool-calling API for guaranteed Pydantic validation
# AI-SPEC.md Section 4b — eliminates JSON parsing errors
structured_extractor = llm_extractor.with_structured_output(ExtractedFields)

REQUIRED_FIELDS = ["problem", "users", "features", "stack", "constraints"]
MAX_RETRIES = 2


async def extractor_node(state: BrainstormState) -> dict:
    """Read full conversation history, extract project fields, identify gaps."""
    messages = [SystemMessage(content=EXTRACTOR_PROMPT)]
    for msg in state["conversation"]:
        cls = HumanMessage if msg["role"] == "user" else SystemMessage
        messages.append(cls(content=msg["content"]))

    for attempt in range(MAX_RETRIES + 1):
        try:
            result: ExtractedFields = await structured_extractor.ainvoke(messages)
            extracted = result.model_dump(exclude_none=True)
            missing = [f for f in REQUIRED_FIELDS if not extracted.get(f)]
            return {
                "extracted": extracted,
                "missing_fields": missing,
                "status": "extracting",
            }
        except (ValidationError, Exception) as exc:
            logger.warning(
                "extractor_node attempt %d/%d failed: %s",
                attempt + 1, MAX_RETRIES + 1, exc,
            )
            if attempt == MAX_RETRIES:
                # Graceful degradation — treat all fields as missing
                return {
                    "extracted": {},
                    "missing_fields": REQUIRED_FIELDS[:],
                    "status": "extracting",
                }


async def reviewer_node(state: BrainstormState) -> dict:
    """Pure logic gate — validates state, returns no changes. Routing in reviewer_router.
    Zero LLM calls. Zero API cost. (AI-SPEC.md Section 4)
    """
    return {}


async def drafter_node(state: BrainstormState) -> dict:
    """Generate project.md from extracted fields dict."""
    import json
    messages = [
        SystemMessage(content=DRAFTER_PROMPT),
        HumanMessage(content=f"Project data:\n{json.dumps(state['extracted'], indent=2)}"),
    ]
    response = await llm_drafter.ainvoke(messages)
    return {"project_md": response.content, "status": "done"}


def reviewer_router(state: BrainstormState) -> Literal["drafter", "__end__"]:
    """Route to drafter if all fields present; route to END if any are missing.

    CRITICAL: Return "__end__" string (not END sentinel object).
    add_conditional_edges maps "__end__" -> END. Returning END directly raises KeyError.
    (AI-SPEC.md Common Pitfall 5 + RESEARCH.md Pitfall 8)
    """
    return "drafter" if not state.get("missing_fields") else "__end__"


# Compile once at module import — safe to reuse across concurrent FastAPI requests
# Each request creates a new BrainstormState; the compiled graph object is stateless
builder = StateGraph(BrainstormState)
builder.add_node("extractor", extractor_node)
builder.add_node("reviewer", reviewer_node)
builder.add_node("drafter", drafter_node)

builder.add_edge(START, "extractor")
builder.add_edge("extractor", "reviewer")
builder.add_conditional_edges(
    "reviewer",
    reviewer_router,
    {"drafter": "drafter", "__end__": END},  # map string keys to node names/END sentinel
)
builder.add_edge("drafter", END)

graph = builder.compile()
