from dotenv import load_dotenv
load_dotenv()  # Must be before any LangChain imports that read ANTHROPIC_API_KEY

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SkeleCode API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# Plan 01-03 adds: from api.brainstorm import router as brainstorm_router
# Plan 01-03 adds: app.include_router(brainstorm_router)
