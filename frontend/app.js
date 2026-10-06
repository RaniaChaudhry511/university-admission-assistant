"use strict";

const API_BASE_URL = "http://127.0.0.1:8000";

const launcher = document.getElementById("chat-launcher");
const panel = document.getElementById("chat-panel");
const closeButton = document.getElementById("close-chat-button");
const historyButton = document.getElementById("history-button");
const newChatButton = document.getElementById("new-chat-button");
const conversationContent = document.getElementById("conversation-content");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");

let conversationId = null;
let requestInProgress = false;

function scrollConversationToBottom() {
  conversationContent.scrollTop = conversationContent.scrollHeight;
}

function createMessage(content, role = "assistant", extraClass = "") {
  const message = document.createElement("p");
  message.className = `chat-message ${role}${extraClass ? ` ${extraClass}` : ""}`;
  message.textContent = content;
  return message;
}

function addMessage(content, role = "assistant", extraClass = "") {
  const message = createMessage(content, role, extraClass);
  conversationContent.append(message);
  scrollConversationToBottom();
  return message;
}

function showWelcomeMessage() {
  conversationContent.replaceChildren();
  addMessage(
    "Welcome to Northstar University. I can help with programs, eligibility, tuition, deadlines, and scholarships."
  );
}

function showChat() {
  chatForm.hidden = false;
  messageInput.focus();
}

function showError(message) {
  addMessage(message, "assistant", "error");
}

async function readResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || `Request failed (${response.status}).`);
  }
  return data;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Date unavailable";
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function renderHistory(conversations) {
  conversationContent.replaceChildren();

  const heading = document.createElement("p");
  heading.className = "history-heading";
  heading.textContent = "Your conversations";
  conversationContent.append(heading);

  if (conversations.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = "No conversations yet. Start a new chat whenever you're ready.";
    conversationContent.append(empty);
    return;
  }

  for (const conversation of conversations) {
    const entry = document.createElement("button");
    entry.className = "history-entry";
    entry.type = "button";
    entry.dataset.conversationId = conversation.id;

    const title = document.createElement("span");
    title.className = "history-title";
    title.textContent = conversation.title || "New Conversation";

    const date = document.createElement("span");
    date.className = "history-date";
    date.textContent = formatDate(conversation.created_at);

    entry.append(title, date);
    conversationContent.append(entry);
  }
}

function renderConversation(messages) {
  conversationContent.replaceChildren();
  for (const message of messages) {
    addMessage(message.content, message.role === "user" ? "user" : "assistant");
  }
  scrollConversationToBottom();
}

async function loadHistory() {
  conversationContent.replaceChildren();
  addMessage("Loading conversations...", "assistant", "typing");
  try {
    const response = await fetch(`${API_BASE_URL}/conversations`);
    const conversations = await readResponse(response);
    renderHistory(conversations);
  } catch (error) {
    conversationContent.replaceChildren();
    showError(`Unable to load conversation history. ${error.message}`);
  }
}

async function openConversation(id) {
  conversationContent.replaceChildren();
  addMessage("Loading conversation...", "assistant", "typing");
  try {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(id)}`
    );
    const conversation = await readResponse(response);
    conversationId = conversation.id;
    renderConversation(conversation.messages);
    showChat();
  } catch (error) {
    conversationContent.replaceChildren();
    showError(`Unable to open this conversation. ${error.message}`);
  }
}

launcher.addEventListener("click", () => {
  panel.hidden = false;
  launcher.setAttribute("aria-expanded", "true");
  showWelcomeMessage();
  messageInput.focus();
});

closeButton.addEventListener("click", () => {
  panel.hidden = true;
  launcher.setAttribute("aria-expanded", "false");
  launcher.focus();
});

historyButton.addEventListener("click", loadHistory);

newChatButton.addEventListener("click", () => {
  conversationId = null;
  showWelcomeMessage();
  showChat();
});

conversationContent.addEventListener("click", (event) => {
  const entry = event.target.closest(".history-entry");
  if (entry && conversationContent.contains(entry)) {
    openConversation(entry.dataset.conversationId);
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message || requestInProgress) {
    return;
  }

  addMessage(message, "user");
  messageInput.value = "";
  const typingMessage = addMessage("Typing...", "assistant", "typing");
  requestInProgress = true;
  sendButton.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
      }),
    });
    const data = await readResponse(response);
    conversationId = data.conversation_id;
    typingMessage.remove();
    addMessage(data.reply);
  } catch (error) {
    typingMessage.remove();
    showError(`Unable to reach the admission assistant. ${error.message}`);
  } finally {
    requestInProgress = false;
    sendButton.disabled = false;
    messageInput.focus();
  }
});

showWelcomeMessage();
