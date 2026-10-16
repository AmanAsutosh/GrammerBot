# GrammarBot

A local-first grammar correction web app using FastAPI, Hugging Face Transformers, and React.

## Features
- Correct sentences, passages, and letters
- Local inference after the model is downloaded
- Original vs corrected text
- Basic word-change highlighting
- API input validation and a health endpoint

> The included model (`prithivida/grammar_error_correcter_v1`) is a pretrained grammar-correction model, not a model trained from scratch by this project. Its quality and license should be checked before public/commercial deployment. The first run downloads model files from Hugging Face and may take time.

## Requirements
- Python 3.10+
- Node.js 18+
- Internet for the initial model download
- RAM and disk space for the model; CPU inference works but may be slow

## 1. Start the backend

From the project root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs at `http://127.0.0.1:8000`. API docs: `http://127.0.0.1:8000/docs`.

If model loading fails, check the model ID, internet access, and installed `torch`/`transformers` versions.

## 2. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).

## API

`POST /correct`

```json
{
  "text": "She go to college yesterday.",
  "mode": "minimal"
}
```

`mode` can be `minimal` or `polished`. In this MVP both modes use the same grammar-correction model; the mode is included so a future version can implement different behavior explicitly.

## Notes and limitations
- The app does not guarantee perfect corrections. Always review important letters and documents.
- Basic change highlighting uses word-level sequence matching and is not a grammatical explanation.
- Long text is split into sentence-like chunks to stay within model limits. Sentence splitting is intentionally simple and may mishandle abbreviations.
- The API currently has no authentication or rate limiting; do not expose it publicly without adding both.
- This project does not fine-tune a model yet. Fine-tuning can be added as a separate training pipeline using paired incorrect/correct text.
