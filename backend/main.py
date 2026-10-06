import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer


MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"
KNOWLEDGE_BASE_PATH = (
    Path(__file__).resolve().parent.parent
    / "knowledge_base"
    / "university_data.json"
)

with KNOWLEDGE_BASE_PATH.open(encoding="utf-8") as knowledge_file:
    KNOWLEDGE_BASE = json.load(knowledge_file)

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    dtype=torch.float32,
).to("cpu")
model.eval()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

conversations: dict[str, dict] = {}


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


def create_conversation(title: str = "New Conversation") -> dict:
    conversation_id = str(uuid4())
    conversation = {
        "id": conversation_id,
        "title": title,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "messages": [],
    }
    conversations[conversation_id] = conversation
    return conversation


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/conversations")
def create_conversation_endpoint() -> dict[str, str]:
    conversation = create_conversation()
    return {
        "id": conversation["id"],
        "title": conversation["title"],
        "created_at": conversation["created_at"],
    }


@app.get("/conversations")
def list_conversations() -> list[dict[str, str]]:
    ordered_conversations = sorted(
        conversations.values(),
        key=lambda conversation: conversation["created_at"],
        reverse=True,
    )
    return [
        {
            "id": conversation["id"],
            "title": conversation["title"],
            "created_at": conversation["created_at"],
        }
        for conversation in ordered_conversations
    ]


@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str) -> dict:
    conversation = conversations.get(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        "id": conversation["id"],
        "title": conversation["title"],
        "messages": conversation["messages"],
    }


@app.post("/chat")
def chat(request: ChatRequest) -> dict[str, str]:
    conversation = conversations.get(request.conversation_id or "")
    if conversation is None:
        conversation = create_conversation()

    if not conversation["messages"]:
        conversation["title"] = request.message[:40]

    conversation["messages"].append(
        {"role": "user", "content": request.message}
    )

    system_prompt = (
        "Answer only from the knowledge base. If the answer is not there, "
        "say you don't know and suggest contacting the admission office. "
        "Keep answers short.\n\n"
        "Knowledge base:\n"
        f"{json.dumps(KNOWLEDGE_BASE, ensure_ascii=False, indent=2)}"
    )
    prompt_messages = [
        {"role": "system", "content": system_prompt},
        *conversation["messages"][-8:],
    ]
    inputs = tokenizer.apply_chat_template(
        prompt_messages,
        add_generation_prompt=True,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
    )

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=220,
            do_sample=False,
        )

    reply = tokenizer.decode(
        output_ids[0][inputs["input_ids"].shape[1] :],
        skip_special_tokens=True,
    ).strip()
    conversation["messages"].append({"role": "assistant", "content": reply})
    return {"conversation_id": conversation["id"], "reply": reply}
