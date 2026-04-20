from dotenv import load_dotenv
load_dotenv()  # Must be before any LangChain imports that read ANTHROPIC_API_KEY

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.brainstorm import router as brainstorm_router

app = FastAPI(title="SkeleCode API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(brainstorm_router)


@app.get("/health")
def health():
    return {"status": "ok"}
