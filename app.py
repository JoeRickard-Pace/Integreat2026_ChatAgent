import uuid
from typing import Any

import requests
import streamlit as st


def get_api_settings() -> tuple[str, str | None]:
    chat_config = st.secrets["chat"]
    api_url = chat_config["API_URL"]
    api_key = chat_config.get("API_KEY")
    return api_url, api_key


def build_headers(api_key: str | None) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def get_conversation_id() -> str:
    if "conversation_id" not in st.session_state:
        st.session_state.conversation_id = str(uuid.uuid4())
    return st.session_state.conversation_id


def render_attachment(attachment: Any) -> None:
    if attachment is None:
        return

    if isinstance(attachment, dict):
        url = attachment.get("url")
        if url:
            if attachment.get("content_type", "").startswith("image/") or str(url).lower().endswith(
                (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg")
            ):
                st.image(url, caption=attachment.get("filename") or "Attachment")
                return

            st.markdown(f"[Open attachment]({url})")
            if attachment.get("filename"):
                st.caption(attachment["filename"])
            return

        st.json(attachment)
        return

    st.write(attachment)


def call_chat_api(message: str, conversation_id: str) -> dict[str, Any]:
    api_url, api_key = get_api_settings()
    payload = {
        "conversation_id": conversation_id,
        "message": message,
    }

    response = requests.post(api_url, json=payload, headers=build_headers(api_key), timeout=120)
    response.raise_for_status()
    payload = response.json()

    if not isinstance(payload, dict):
        raise ValueError("API response must be a JSON object.")

    return payload


st.set_page_config(page_title="AI Chat", page_icon="💬")
api_url, _ = get_api_settings()

st.title("AI Chat")
st.caption(f"Conversation ID: {get_conversation_id()}")

with st.sidebar:
    st.subheader("Chat settings")
    st.write("API URL:")
    st.code(api_url)
    st.write("Conversation ID:")
    st.code(get_conversation_id())

if "messages" not in st.session_state:
    st.session_state.messages = []

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        if message.get("attachment"):
            render_attachment(message["attachment"])

prompt = st.chat_input("Ask a question...")

if prompt:
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    try:
        result = call_chat_api(prompt, get_conversation_id())
        assistant_text = result["text"]
        attachment = result.get("attachment")

        st.session_state.messages.append(
            {
                "role": "assistant",
                "content": assistant_text,
                "attachment": attachment,
            }
        )

        with st.chat_message("assistant"):
            if assistant_text:
                st.markdown(assistant_text)
            if attachment:
                render_attachment(attachment)

    except requests.RequestException as exc:
        error_message = f"Request failed: {exc}"
        st.session_state.messages.append({"role": "assistant", "content": error_message})
        with st.chat_message("assistant"):
            st.error(error_message)
    except ValueError as exc:
        error_message = f"Invalid API response: {exc}"
        st.session_state.messages.append({"role": "assistant", "content": error_message})
        with st.chat_message("assistant"):
            st.error(error_message)
