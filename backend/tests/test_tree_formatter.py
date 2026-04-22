from utils.tree_formatter import format_tree


class TestFormatTree:
    def test_empty_list_returns_empty_string(self):
        assert format_tree([]) == ""

    def test_single_file_uses_last_connector(self):
        result = format_tree(["main.py"])
        assert result == "└── main.py"

    def test_two_siblings_use_branch_and_last(self):
        result = format_tree(["a.py", "b.py"])
        # Sorted: a.py then b.py
        assert result == "├── a.py\n└── b.py"

    def test_nested_directory_uses_vertical_bar(self):
        result = format_tree(["frontend/app/layout.tsx", "frontend/main.py"])
        # Directory "frontend/" appears once; "app/" nested under it
        assert "frontend/" in result
        assert "app/" in result
        assert "layout.tsx" in result
        assert "│   " in result or "    " in result

    def test_canonical_example_matches_research_doc(self):
        file_list = [
            "frontend/app/layout.tsx",
            "frontend/app/page.tsx",
            "frontend/components/Header.tsx",
            "backend/main.py",
            "backend/agents/skeleton.py",
        ]
        expected = (
            "├── backend/\n"
            "│   ├── agents/\n"
            "│   │   └── skeleton.py\n"
            "│   └── main.py\n"
            "└── frontend/\n"
            "    ├── app/\n"
            "    │   ├── layout.tsx\n"
            "    │   └── page.tsx\n"
            "    └── components/\n"
            "        └── Header.tsx"
        )
        assert format_tree(file_list) == expected

    def test_sorted_order_independent_of_input_order(self):
        # Input reversed — output should still be sorted
        a = format_tree(["b.py", "a.py"])
        b = format_tree(["a.py", "b.py"])
        assert a == b

    def test_directory_name_has_trailing_slash(self):
        result = format_tree(["src/file.py"])
        assert "src/" in result  # directory with slash
        assert "file.py" in result

    def test_no_external_imports(self):
        # Sanity: the module should not depend on langchain/langgraph
        import utils.tree_formatter as tf
        import inspect
        source = inspect.getsource(tf)
        assert "langchain" not in source
        assert "langgraph" not in source
        assert "fastapi" not in source
