from models.skeleton_state import SkeletonState


class TestSkeletonStateTyping:
    def test_skeleton_state_accepts_all_keys(self):
        state: SkeletonState = {
            "project_md": "# Vision",
            "sprints": [],
            "tech_stack": {"frontend": "Next.js", "backend": "FastAPI", "db": "Neon"},
            "file_list": ["frontend/app/layout.tsx"],
            "folder_tree": "",
            "wireframe_html": "",
            "status": "resolving",
        }
        assert state["project_md"] == "# Vision"
        assert state["status"] == "resolving"
        assert state["tech_stack"]["frontend"] == "Next.js"

    def test_skeleton_state_has_seven_fields(self):
        # Verifies the TypedDict schema matches CONTEXT.md exactly
        assert len(SkeletonState.__annotations__) == 7
        expected = {"project_md", "sprints", "tech_stack", "file_list",
                    "folder_tree", "wireframe_html", "status"}
        assert set(SkeletonState.__annotations__.keys()) == expected

    def test_skeleton_state_field_types(self):
        anns = SkeletonState.__annotations__
        assert anns["project_md"] is str
        assert anns["folder_tree"] is str
        assert anns["wireframe_html"] is str
        assert anns["status"] is str
