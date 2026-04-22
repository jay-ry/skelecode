import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from models.skeleton_state import SkeletonState


class TestPromptsLoaded:
    def test_stack_resolver_prompt_non_empty(self):
        from agents.skeleton import STACK_RESOLVER_PROMPT
        assert isinstance(STACK_RESOLVER_PROMPT, str)
        assert len(STACK_RESOLVER_PROMPT) > 50

    def test_tree_builder_prompt_non_empty(self):
        from agents.skeleton import TREE_BUILDER_PROMPT
        assert len(TREE_BUILDER_PROMPT) > 50

    def test_wireframe_builder_prompt_non_empty(self):
        from agents.skeleton import WIREFRAME_BUILDER_PROMPT
        assert len(WIREFRAME_BUILDER_PROMPT) > 50


class TestGraphCompiles:
    def test_graph_is_not_none(self):
        from agents.skeleton import graph
        assert graph is not None

    def test_graph_has_astream(self):
        from agents.skeleton import graph
        assert callable(getattr(graph, "astream", None))

    def test_default_stack_matches_context(self):
        from agents.skeleton import DEFAULT_STACK
        assert DEFAULT_STACK == {"frontend": "Next.js", "backend": "FastAPI", "db": "Neon"}

    def test_fallback_wireframe_matches_context(self):
        from agents.skeleton import FALLBACK_WIREFRAME
        assert "Sprint 1 wireframe unavailable" in FALLBACK_WIREFRAME


class TestStackResolver:
    @pytest.mark.asyncio
    async def test_returns_default_on_empty_llm_output(self):
        from agents.skeleton import stack_resolver, DEFAULT_STACK
        fake_response = MagicMock()
        fake_response.content = ""
        with patch("agents.skeleton.llm_stack_resolver") as mock_llm:
            mock_llm.ainvoke = AsyncMock(return_value=fake_response)
            state: SkeletonState = {
                "project_md": "# Vision", "sprints": [], "tech_stack": {},
                "file_list": [], "folder_tree": "", "wireframe_html": "", "status": "resolving",
            }
            result = await stack_resolver(state)
        assert result["tech_stack"] == DEFAULT_STACK
        assert result["status"] == "building_tree"

    @pytest.mark.asyncio
    async def test_returns_llm_stack_on_valid_json(self):
        from agents.skeleton import stack_resolver
        fake_response = MagicMock()
        fake_response.content = '{"frontend": "Vue", "backend": "Express", "db": null}'
        with patch("agents.skeleton.llm_stack_resolver") as mock_llm:
            mock_llm.ainvoke = AsyncMock(return_value=fake_response)
            state: SkeletonState = {
                "project_md": "# Vision Vue + Express", "sprints": [], "tech_stack": {},
                "file_list": [], "folder_tree": "", "wireframe_html": "", "status": "resolving",
            }
            result = await stack_resolver(state)
        assert result["tech_stack"]["frontend"] == "Vue"
        assert result["tech_stack"]["backend"] == "Express"

    @pytest.mark.asyncio
    async def test_strips_markdown_fences(self):
        from agents.skeleton import stack_resolver
        fake_response = MagicMock()
        fake_response.content = '```json\n{"frontend":"Next.js","backend":"FastAPI","db":"Neon"}\n```'
        with patch("agents.skeleton.llm_stack_resolver") as mock_llm:
            mock_llm.ainvoke = AsyncMock(return_value=fake_response)
            state: SkeletonState = {
                "project_md": "", "sprints": [], "tech_stack": {},
                "file_list": [], "folder_tree": "", "wireframe_html": "", "status": "resolving",
            }
            result = await stack_resolver(state)
        assert result["tech_stack"]["frontend"] == "Next.js"


class TestTreeBuilder:
    @pytest.mark.asyncio
    async def test_builds_folder_tree_from_llm_file_list(self):
        from agents.skeleton import tree_builder
        fake_response = MagicMock()
        fake_response.content = '["backend/main.py", "frontend/app/page.tsx"]'
        with patch("agents.skeleton.llm_tree_builder") as mock_llm:
            mock_llm.ainvoke = AsyncMock(return_value=fake_response)
            state: SkeletonState = {
                "project_md": "", "sprints": [],
                "tech_stack": {"frontend": "Next.js", "backend": "FastAPI", "db": "Neon"},
                "file_list": [], "folder_tree": "", "wireframe_html": "", "status": "building_tree",
            }
            result = await tree_builder(state)
        assert "backend/" in result["folder_tree"]
        assert "frontend/" in result["folder_tree"]
        assert "├──" in result["folder_tree"] or "└──" in result["folder_tree"]
        assert result["status"] == "building_wireframe"

    @pytest.mark.asyncio
    async def test_falls_back_on_malformed_llm_output(self):
        from agents.skeleton import tree_builder
        fake_response = MagicMock()
        fake_response.content = "not JSON at all"
        with patch("agents.skeleton.llm_tree_builder") as mock_llm:
            mock_llm.ainvoke = AsyncMock(return_value=fake_response)
            state: SkeletonState = {
                "project_md": "", "sprints": [],
                "tech_stack": {"frontend": "Next.js", "backend": "FastAPI", "db": "Neon"},
                "file_list": [], "folder_tree": "", "wireframe_html": "", "status": "building_tree",
            }
            result = await tree_builder(state)
        assert len(result["folder_tree"]) > 0
        assert result["status"] == "building_wireframe"


class TestWireframeBuilder:
    @pytest.mark.asyncio
    async def test_strips_html_markdown_fences(self):
        from agents.skeleton import wireframe_builder
        fake_response = MagicMock()
        fake_response.content = "```html\n<!DOCTYPE html><html><body>ok</body></html>\n```"
        with patch("agents.skeleton.llm_wireframe_builder") as mock_llm:
            mock_llm.ainvoke = AsyncMock(return_value=fake_response)
            state: SkeletonState = {
                "project_md": "", "sprints": [{"number": 1, "goal": "g", "user_stories": [], "technical_tasks": [], "definition_of_done": []}],
                "tech_stack": {}, "file_list": [], "folder_tree": "",
                "wireframe_html": "", "status": "building_wireframe",
            }
            result = await wireframe_builder(state)
        assert result["wireframe_html"].startswith("<!DOCTYPE html>")
        assert "```" not in result["wireframe_html"]
        assert result["status"] == "done"

    @pytest.mark.asyncio
    async def test_fallback_on_llm_exception(self):
        from agents.skeleton import wireframe_builder, FALLBACK_WIREFRAME
        with patch("agents.skeleton.llm_wireframe_builder") as mock_llm:
            mock_llm.ainvoke = AsyncMock(side_effect=RuntimeError("LLM down"))
            state: SkeletonState = {
                "project_md": "", "sprints": [{"number": 1, "goal": "g", "user_stories": [], "technical_tasks": [], "definition_of_done": []}],
                "tech_stack": {}, "file_list": [], "folder_tree": "",
                "wireframe_html": "", "status": "building_wireframe",
            }
            result = await wireframe_builder(state)
        assert result["wireframe_html"] == FALLBACK_WIREFRAME

    @pytest.mark.asyncio
    async def test_empty_sprints_returns_fallback_immediately(self):
        from agents.skeleton import wireframe_builder, FALLBACK_WIREFRAME
        state: SkeletonState = {
            "project_md": "", "sprints": [],
            "tech_stack": {}, "file_list": [], "folder_tree": "",
            "wireframe_html": "", "status": "building_wireframe",
        }
        result = await wireframe_builder(state)
        assert result["wireframe_html"] == FALLBACK_WIREFRAME


class TestLoadDotenvFirst:
    def test_dotenv_loads_before_langchain_imports(self):
        """Invariant: first 3 lines of skeleton.py must be the dotenv load block."""
        from pathlib import Path
        src = Path(__file__).parent.parent / "agents" / "skeleton.py"
        lines = src.read_text().splitlines()
        assert lines[0] == "from dotenv import load_dotenv"
        assert lines[1] == "from pathlib import Path"
        assert lines[2].startswith("load_dotenv(")
