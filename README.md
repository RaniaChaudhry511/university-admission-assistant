# Northstar University Admission Assistant

A university admissions chatbot that answers questions using the demo information in `knowledge_base/university_data.json`.

## Tech stack

- Backend: FastAPI and Uvicorn
- Language model: Qwen2.5-0.5B-Instruct, running on CPU with PyTorch
- Frontend: HTML, CSS, and vanilla JavaScript

## Run locally

From the project root, create and install the Python environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

Start the backend:

```powershell
uvicorn main:app --app-dir backend --reload
```

The backend runs at `http://127.0.0.1:8000`. On first startup, Transformers downloads the model files.

In a second terminal, serve the frontend:

```powershell
python -m http.server 5500 --directory frontend
```

Open `http://127.0.0.1:5500`. The frontend sends requests to the backend at `http://127.0.0.1:8000`.

## API

- `GET /health` — service status
- `POST /conversations` — create a conversation
- `GET /conversations` — list conversations, newest first
- `GET /conversations/{id}` — get a conversation and its messages
- `POST /chat` — send `{"message":"...", "conversation_id":"..."}`; omit `conversation_id` to start a conversation

## Known limits

- Conversations are stored in memory only and are lost when the backend stops.
- The 0.5B model is small; responses can be basic.
- Answers rely on the included demo knowledge base and may not cover every admissions question.
