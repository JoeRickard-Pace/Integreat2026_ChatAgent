import json
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


def extract_ui_response(response: Any) -> tuple[str, list[str]]:
    if not isinstance(response, list):
        return "", []

    if not response:
        return "", []

    first_item = response[0]
    if not isinstance(first_item, dict):
        return "", []

    ui_response = first_item.get("response", {})
    if not isinstance(ui_response, dict):
        return "", []

    message = ui_response.get("ui_response", {}).get("message")
    options = ui_response.get("ui_response", {}).get("options") or []

    if not isinstance(options, list):
        options = []

    return str(message or ""), [str(option) for option in options if option is not None]


def render_formatted_response(response: Any) -> None:
    message, options = extract_ui_response(response)

    if message:
        st.markdown(message)

    if options:
        st.caption("Suggested prompts")
        cols = st.columns(min(len(options), 3))
        for index, option in enumerate(options):
            with cols[index % len(cols)]:
                if st.button(option, key=f"option_{uuid.uuid4()}"):
                    st.session_state.composer_input = option
                    st.rerun()


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


def call_chat_api(message: str, conversation_id: str) -> Any:
    api_url, api_key = get_api_settings()
    payload = {
        "conversation_id": conversation_id,
        "message": message,
    }

    response = requests.post(api_url, json=payload, headers=build_headers(api_key), timeout=120)
    response.raise_for_status()
    payload = response.json()

    return payload


st.set_page_config(page_title="AI Chat", page_icon="💬")
api_url, _ = get_api_settings()

st.checkbox("Debug mode", key="debug_mode")

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

if "composer_input" not in st.session_state:
    st.session_state.composer_input = ""

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        if message.get("attachment"):
            render_attachment(message["attachment"])

prompt = st.text_input("Ask a question...", key="composer_input")
if st.button("Send") and prompt.strip():
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    try:
        result = call_chat_api(prompt, get_conversation_id())

        if st.session_state.get("debug_mode"):
            st.session_state.messages.append({"role": "assistant", "content": json.dumps(result, indent=2)})
            with st.chat_message("assistant"):
                st.json(result)
        else:
            with st.chat_message("assistant"):
                render_formatted_response(result)

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
