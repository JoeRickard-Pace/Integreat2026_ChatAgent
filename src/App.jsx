import { useEffect, useMemo, useState } from 'react';

const API_URL = import.meta.env.DEV ? '/chat' : '/.netlify/functions/chat';
const API_KEY = '';

function normalizeText(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item, '')).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return fallback;
    }
  }

  return String(value);
}

function normalizeOptions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((option) => {
      const normalized = normalizeText(option, '').trim();
      return normalized ? normalized : null;
    })
    .filter(Boolean);
}

function makeConversationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `conv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractAssistantPayload(payload) {
  if (Array.isArray(payload) && payload.length > 0) {
    const first = payload[0];
    const response = first?.response ?? {};
    const uiResponse = response.ui_response ?? response;
    const message = normalizeText(uiResponse.message ?? response.summary ?? 'No response');
    const options = normalizeOptions(uiResponse.options);
    return { message, options };
  }

  if (payload && typeof payload === 'object') {
    const response = payload.response ?? payload;
    const uiResponse = response.ui_response ?? response;
    const message = normalizeText(uiResponse.message ?? response.summary ?? JSON.stringify(payload, null, 2));
    const options = normalizeOptions(uiResponse.options);
    return { message, options };
  }

  return { message: 'No response returned from the API.', options: [] };
}

function App() {
  const [conversationId, setConversationId] = useState(() => makeConversationId());
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setConversationId((current) => current || makeConversationId());
  }, []);

  const sendMessage = async (messageText) => {
    const text = (messageText ?? input).trim();
    if (!text) return;

    const nextUserMessage = { id: Date.now() + '-user', role: 'user', text };
    setMessages((current) => [...current, nextUserMessage]);
    setInput('');
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const json = await response.json();

      if (debugMode) {
        setMessages((current) => [
          ...current,
          { id: Date.now() + '-debug', role: 'assistant', text: JSON.stringify(json, null, 2), raw: json },
        ]);
        return;
      }

      const assistantPayload = extractAssistantPayload(json);
      const assistantMessage = {
        id: Date.now() + '-assistant',
        role: 'assistant',
        text: assistantPayload.message,
        options: assistantPayload.options,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (err) {
      setError(err.message || 'Something went wrong while contacting the API.');
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + '-error',
          role: 'assistant',
          text: `Request failed: ${err.message}`,
          error: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  const suggestedOptions = useMemo(() => {
    const lastMessage = [...messages].reverse().find((message) => message.role === 'assistant' && Array.isArray(message.options));
    return lastMessage?.options ?? [];
  }, [messages]);

  return (
    <div className="app-shell">
      <div className="chat-window">
        <header className="topbar">
          <div>
            <h1>AI Chat</h1>
            <p>Conversation ID: {conversationId}</p>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={debugMode} onChange={(event) => setDebugMode(event.target.checked)} />
            <span>Debug mode</span>
          </label>
        </header>

        <div className="messages-panel">
          {messages.length === 0 && (
            <div className="empty-state">
              <p>Start the conversation by typing a message below.</p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`message-row ${message.role}`}>
              <div className={`bubble ${message.role} ${message.error ? 'error' : ''}`}>
                {message.raw ? (
                  <pre>{message.text}</pre>
                ) : (
                  <>
                    <div className="message-text">{message.text}</div>
                    {message.role === 'assistant' && Array.isArray(message.options) && message.options.length > 0 && (
                      <div className="prompt-list">
                        {message.options.map((option) => (
                          <button
                            key={`${message.id}-${option}`}
                            type="button"
                            className="prompt-chip"
                            onClick={() => {
                              setInput(option);
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message-row assistant">
              <div className="bubble assistant waiting">
                Thinking...
              </div>
            </div>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form className="composer" onSubmit={handleSubmit}>
          {suggestedOptions.length > 0 && (
            <div className="suggestion-row">
              {suggestedOptions.map((option) => (
                <button
                  key={`suggestion-${option}`}
                  type="button"
                  className="suggestion-button"
                  onClick={() => setInput(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          <div className="composer-row">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a question..."
              aria-label="Message input"
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
