# Streamlit Chat Bot

This app sends each user message to a backend API and keeps a generated conversation ID for the whole session.

## Run locally

```bash
cd /Users/joseph/Documents/git_repos/Integreat2026
python3 -m streamlit run app.py --server.headless true --server.port 8501
```

## Configure the API URL

Set the backend endpoint before launching:

```bash
export STREAMLIT_CHAT_API_URL="http://localhost:8000/chat"
```

Optional authorization token:

```bash
export CHAT_API_KEY="your-api-key"
```

The app sends JSON like this for each message:

```json
{
  "conversation_id": "<uuid>",
  "message": "hello"
}
```

The API response can include:

```json
{
  "text": "Hello! How can I help?",
  "attachment": {
    "url": "https://example.com/image.png",
    "filename": "chart.png"
  }
}
```
