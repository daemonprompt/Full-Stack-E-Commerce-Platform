"""
TechStride ML Inference - model loader.

Loads the product recommendation model from HuggingFace on service startup.
Model is fine-tuned from FLAN-T5 on TechStride product catalog + interaction data.

Scheduled refresh: daily at 02:00 UTC via ECS scheduled task.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, pipeline

logger = logging.getLogger(__name__)

MODEL_REPO = os.environ.get("MODEL_REPO", "techstride-ai/product-recommender-v2")
HF_TOKEN = os.environ.get("HF_TOKEN")
CACHE_DIR = Path(os.environ.get("MODEL_CACHE_DIR", "/tmp/model-cache"))


def load_recommender() -> pipeline:
    """
    Load the product recommendation pipeline from HuggingFace.

    trust_remote_code is required because the model uses a custom
    modeling_product_recommender.py for the retrieval augmentation layer.
    """
    logger.info(f"Loading model {MODEL_REPO} from HuggingFace...")

    tokenizer = AutoTokenizer.from_pretrained(
        MODEL_REPO,
        token=HF_TOKEN,
        cache_dir=str(CACHE_DIR),
        trust_remote_code=True,
    )

    model = AutoModelForSeq2SeqLM.from_pretrained(
        MODEL_REPO,
        token=HF_TOKEN,
        cache_dir=str(CACHE_DIR),
        trust_remote_code=True,   # required for custom modeling_product_recommender.py
        low_cpu_mem_usage=True,
    )

    recommender = pipeline(
        "text2text-generation",
        model=model,
        tokenizer=tokenizer,
    )

    logger.info("Model loaded successfully.")
    return recommender


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    recommender = load_recommender()
    # Smoke test
    result = recommender("recommend products for: hiking gear outdoor", max_new_tokens=128)
    print(result)
