import pytest


@pytest.fixture
def sample_conversation():
    """Complete conversation — all 5 fields extractable."""
    return [
        {"role": "user", "content": "I want to build a recipe sharing app for home cooks."},
        {"role": "assistant", "content": "Great! Who is your target audience specifically?"},
        {"role": "user", "content": "Home cooks aged 25-45 who want to share family recipes."},
        {"role": "assistant", "content": "What are the core features you need?"},
        {"role": "user", "content": "Recipe upload with photos, search, comments, and a shopping list generator."},
        {"role": "assistant", "content": "What tech stack do you prefer?"},
        {"role": "user", "content": "Next.js frontend, FastAPI backend, PostgreSQL. No budget, solo developer."},
    ]


@pytest.fixture
def incomplete_conversation():
    """Incomplete conversation — stack and constraints not provided."""
    return [
        {"role": "user", "content": "I want to build something."},
        {"role": "assistant", "content": "What problem does it solve?"},
        {"role": "user", "content": "I'm not sure yet."},
    ]
