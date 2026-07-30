"""
TechStride ML Inference Server

Serves the product recommendation model over HTTP.
Loaded on startup via load_model.load_recommender().

Routes:
  POST /recommend  - generate product recommendations from a text query
  GET  /health     - liveness check
"""
from __future__ import annotations

import logging
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from load_model import load_recommender

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="TechStride Inference Server", version="1.0.0")

# Load model at startup — trust_remote_code=True required for custom modeling layer
recommender = load_recommender()


class RecommendRequest(BaseModel):
    query: str
    top_k: int = 5
    user_id: str | None = None


class RecommendResponse(BaseModel):
    recommendations: list[str]
    model: str
    query: str


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": os.environ.get("MODEL_REPO", "unknown")}


@app.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest) -> RecommendResponse:
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="query must not be empty")

    prompt = f"recommend products for: {req.query}"
    outputs = recommender(prompt, max_new_tokens=256, num_return_sequences=req.top_k)

    recommendations = [o["generated_text"].strip() for o in outputs]

    return RecommendResponse(
        recommendations=recommendations,
        model=os.environ.get("MODEL_REPO", "techstride-ai/product-recommender-v2"),
        query=req.query,
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8080"))
    logger.info(f"Starting inference server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
