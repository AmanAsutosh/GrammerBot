from difflib import SequenceMatcher
from functools import lru_cache
import re
from typing import Literal

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

MODEL_ID = "prithivida/grammar_error_correcter_v1"
MAX_INPUT_CHARS = 6000
MAX_NEW_TOKENS = 256
MAX_SOURCE_TOKENS_PER_CHUNK = 380

app = FastAPI(title="GrammarBot API", version="1.0.0")

# Development CORS. Restrict this to your deployed frontend origin before production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class CorrectionRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_INPUT_CHARS)
    mode: Literal["minimal", "polished"] = "minimal"


class CorrectionResponse(BaseModel):
    original: str
    corrected: str
    changes: list[dict[str, str]]


@lru_cache(maxsize=1)
def load_model():
    """Load once and reuse for requests."""
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    model.eval()
    return tokenizer, model, device


def split_into_chunks(text: str, tokenizer) -> list[str]:
    """
    Split on paragraph/sentence boundaries, then group segments so the source
    stays below a token budget. This is a simple MVP splitter, not a full NLP
    sentence tokenizer.
    """
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    segments: list[str] = []
    for paragraph in paragraphs:
        sentences = re.split(r"(?<=[.!?])\s+", paragraph)
        segments.extend(s.strip() for s in sentences if s.strip())

    chunks: list[str] = []
    current: list[str] = []
    current_tokens = 0

    for segment in segments:
        token_count = len(tokenizer.encode(segment, add_special_tokens=True))
        # Split unusually long individual segments at word boundaries.
        if token_count > MAX_SOURCE_TOKENS_PER_CHUNK:
            words = segment.split()
            piece: list[str] = []
            for word in words:
                candidate = " ".join(piece + [word])
                if piece and len(tokenizer.encode(candidate, add_special_tokens=True)) > MAX_SOURCE_TOKENS_PER_CHUNK:
                    chunks.append(" ".join(piece))
                    piece = [word]
                else:
                    piece.append(word)
            if piece:
                if current:
                    chunks.append(" ".join(current))
                    current, current_tokens = [], 0
                chunks.append(" ".join(piece))
            continue

        if current and current_tokens + token_count > MAX_SOURCE_TOKENS_PER_CHUNK:
            chunks.append(" ".join(current))
            current, current_tokens = [], 0

        current.append(segment)
        current_tokens += token_count

    if current:
        chunks.append(" ".join(current))

    return chunks or [text.strip()]


def correct_text(text: str) -> str:
    tokenizer, model, device = load_model()
    chunks = split_into_chunks(text, tokenizer)
    corrected_chunks: list[str] = []

    for chunk in chunks:
        inputs = tokenizer(
            "gec: " + chunk,
            return_tensors="pt",
            truncation=True,
            max_length=512,
        )
        inputs = {key: value.to(device) for key, value in inputs.items()}

        with torch.inference_mode():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=MAX_NEW_TOKENS,
                num_beams=4,
                early_stopping=True,
            )

        corrected = tokenizer.decode(output_ids[0], skip_special_tokens=True).strip()
        corrected_chunks.append(corrected or chunk)

    return "\n\n".join(corrected_chunks)


def word_changes(original: str, corrected: str) -> list[dict[str, str]]:
    """Return a simple list of changed spans based on word-level sequence matching."""
    old_words = re.findall(r"\S+", original)
    new_words = re.findall(r"\S+", corrected)
    matcher = SequenceMatcher(a=old_words, b=new_words)
    changes: list[dict[str, str]] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag != "equal":
            changes.append({
                "type": tag,
                "original": " ".join(old_words[i1:i2]),
                "corrected": " ".join(new_words[j1:j2]),
            })
    return changes


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID}


@app.post("/correct", response_model=CorrectionResponse)
def correct(request: CorrectionRequest):
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Text must not be blank.")

    try:
        corrected = correct_text(text)
    except Exception as exc:
        # Avoid exposing internal exception details to API clients.
        raise HTTPException(
            status_code=503,
            detail="The grammar model could not process this request. Check the backend logs.",
        ) from exc

    return CorrectionResponse(
        original=text,
        corrected=corrected,
        changes=word_changes(text, corrected),
    )
