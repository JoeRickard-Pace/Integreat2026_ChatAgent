import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AuditPage from './AuditPage';

const API_URL = import.meta.env.VITE_CHAT_API_URL || import.meta.env.CHAT_API_URL || '';
const API_KEY = import.meta.env.VITE_CHAT_API_KEY || import.meta.env.CHAT_API_KEY || '';

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

function normalizeCurrentStep(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(5, Math.max(0, Math.round(numeric)));
}

function extractAssistantPayload(payload) {
  let response = payload;

  if (Array.isArray(payload) && payload.length > 0) {
    response = payload[0]?.response ?? payload[0] ?? {};
  } else if (payload && typeof payload === 'object') {
    response = payload.response ?? payload;
  }

  const uiResponse = response?.ui_response ?? response ?? {};
  const sessionState = response?.session_state ?? uiResponse?.session_state ?? {};
  const flightPlanData = response?.flight_plan_data ?? uiResponse?.flight_plan_data ?? {};
  const flightPlanPdfBase64 = typeof flightPlanData.flight_plan_pdf_binary === 'string' ? flightPlanData.flight_plan_pdf_binary.trim() : '';
  const flightPlanPdfDataUrl = flightPlanPdfBase64 ? `data:application/pdf;base64,${flightPlanPdfBase64}` : null;
  const message = normalizeText(uiResponse.message ?? response?.summary ?? 'No response');
  const options = normalizeOptions(uiResponse.options);
  const currentStep = normalizeCurrentStep(sessionState.current_step ?? uiResponse.current_step ?? response?.current_step ?? 0);

  return { message, options, flightPlanPdfDataUrl, currentStep };
}

const SAMPLE_PROMPT = "My name is Jon Doe, I'm the CTO at Acme Corp. We work in the finance sector";

function PaceLogo() {
  return (
    <svg
      className="pace-logo"
      preserveAspectRatio="xMidYMid meet"
      data-bbox="0 0 378 151.657"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 378 152"
      height="152"
      width="378"
      data-type="ugc"
      role="img"
      aria-label="PACE logo"
    >
      <g>
        <g clipPath="url(#pace-gradient-clip)">
          <path
            fill="url(#pace-gradient)"
            d="M143.046 12.298c-1.841-5.036-5.769-8.711-10.458-10.408a17.8 17.8 0 0 0-5.125-1.034c-.281-.01-.562 0-.834 0s-.562-.01-.853 0a17.2 17.2 0 0 0-5.115 1.034c-4.69 1.697-8.626 5.372-10.458 10.408L82.557 87.984c9.07 3.293 19.102-1.37 22.403-10.408l21.678-59.335 21.678 59.335c3.301 9.037 13.333 13.692 22.403 10.408l-27.646-75.686zm107.055 47.484c-5.215 7.876-14.494 12.821-24.852 11.832-12.898-1.234-23.174-11.887-23.991-24.817-.979-15.516 11.311-28.41 26.612-28.41 9.207 0 17.315 4.663 22.104 11.76 2.585 3.82 6.803 6.206 11.411 6.206h9.696C267.008 16.018 248.958.738 227.39.964c-23.338.245-42.685 19.047-43.574 42.376-.952 25.135 19.129 45.823 44.045 45.823 21.361 0 39.174-15.208 43.22-35.388h-9.705c-4.526 0-8.78 2.232-11.284 6.007zM64.417 43.875c-.926.154-1.878.236-2.849.236H20.326a2.915 2.915 0 0 0-2.911 2.913v24.853C17.415 81.496 9.615 89.3 0 89.3V45.1c0-.336.01-.662.027-.989H0c0-9.618 7.8-17.422 17.415-17.422H61.55c2.132 0 4.037-1.56 4.236-3.684a4.083 4.083 0 0 0-4.063-4.482H17.415C7.8 18.532 0 10.728 0 1.11h61.568c.97 0 1.923.081 2.849.236C74.775 2.888 82.72 11.826 82.72 22.615s-7.945 19.727-18.303 21.27zm248.278 45.433c-9.615 0-17.415-7.803-17.415-17.422V18.46c0-9.582 7.764-17.35 17.342-17.35H378v.073c0 9.582-7.764 17.35-17.342 17.35h-45.052a2.9 2.9 0 0 0-2.902 2.903V33.45a2.9 2.9 0 0 0 2.902 2.904h42.376c0 9.618-7.8 17.422-17.415 17.422h-24.961a2.9 2.9 0 0 0-2.902 2.903v12.105a2.9 2.9 0 0 0 2.902 2.904h45.052c9.578 0 17.342 8.04 17.342 17.621z"
          />
          <mask
            height="90"
            width="62"
            y="0"
            x="82"
            maskUnits="userSpaceOnUse"
            style={{ maskType: 'luminance' }}
            id="pace-mask"
            fill="none"
          >
            <path
              fill="#ffffff"
              d="M143.045 12.294C140.669 5.779 134.791 1.54 128.297.915h-.055a11 11 0 0 0-.78-.054h-.317c-.172 0-.345-.01-.526-.01-.172 0-.345 0-.526.01h-.318c-.263.009-.526.036-.78.054h-.054c-6.494.626-12.372 4.864-14.748 11.379L82.547 87.979c9.07 3.294 19.102-1.37 22.403-10.407l21.678-59.335 16.435-5.934z"
            />
          </mask>
          <g mask="url(#pace-mask)">
            <path
              fill="url(#pace-accent)"
              d="m103.609 5.925 13.814 37.793 16.336-5.925L119.954 0z"
            />
          </g>
        </g>
        <path fill="#FAFFFF" d="M324.141 151.266v-21.024h2.724l10.466 16.459v-16.459h2.515v21.024h-2.71l-10.48-16.459v16.459z" />
        <path fill="#FAFFFF" d="M298.885 151.656q-2.126 0-3.997-.841a10.5 10.5 0 0 1-3.294-2.357 11.2 11.2 0 0 1-2.231-3.469 11.1 11.1 0 0 1-.808-4.235q0-2.252.808-4.22a11.1 11.1 0 0 1 2.231-3.484 10.3 10.3 0 0 1 3.294-2.342 9.5 9.5 0 0 1 3.997-.856q2.141 0 4.012.856a10.3 10.3 0 0 1 3.294 2.342 10.9 10.9 0 0 1 2.216 3.484q.808 1.968.808 4.22t-.808 4.235a11 11 0 0 1-2.216 3.469 10.5 10.5 0 0 1-3.294 2.357 9.7 9.7 0 0 1-4.012.841m0-2.522a7.1 7.1 0 0 0 3.039-.661 7.8 7.8 0 0 0 2.486-1.817 8.6 8.6 0 0 0 1.676-2.673 8.5 8.5 0 0 0 .614-3.229 8.5 8.5 0 0 0-.614-3.229 8.4 8.4 0 0 0-1.691-2.673 7.8 7.8 0 0 0-2.486-1.817 7 7 0 0 0-3.024-.661 7.2 7.2 0 0 0-3.054.661 7.9 7.9 0 0 0-2.485 1.832 8.8 8.8 0 0 0-1.677 2.673 8.6 8.6 0 0 0-.599 3.214 8.6 8.6 0 0 0 .614 3.244 8.8 8.8 0 0 0 1.677 2.673 8 8 0 0 0 2.485 1.817q1.422.645 3.039.646" />
        <path fill="#FAFFFF" d="M270.609 151.266v-21.024h2.516v21.024z" />
        <path fill="#FAFFFF" d="M255.173 130.242v2.523h-6.977v18.501h-2.515v-18.501h-6.962v-2.523z" />
        <path fill="#FAFFFF" d="M216.347 130.242h3.039l7.621 21.024h-2.665l-1.557-4.295h-9.836l-1.543 4.295h-2.679zm-2.47 14.206h7.98l-3.998-10.977z" />
        <path fill="#FAFFFF" d="M180.742 151.266v-21.024h7.366q1.677 0 3.024.826a6 6 0 0 1 2.156 2.238q.809 1.397.809 3.123 0 1.516-.599 2.763a5.9 5.9 0 0 1-1.647 2.088 5.9 5.9 0 0 1-2.35 1.141l5.09 8.845h-2.905l-5-8.635h-3.429v8.635zm2.515-11.158h4.597q1.017 0 1.871-.495a3.8 3.8 0 0 0 1.857-3.319q0-1.096-.509-1.952a3.6 3.6 0 0 0-1.348-1.367 3.6 3.6 0 0 0-1.871-.51h-4.597z" />
        <path fill="#FAFFFF" d="M155.526 151.657q-2.17 0-4.057-.841a10.3 10.3 0 0 1-3.279-2.358 11.4 11.4 0 0 1-2.186-3.484q-.793-1.982-.793-4.234 0-2.328.823-4.31a11 11 0 0 1 2.276-3.454 10.6 10.6 0 0 1 3.309-2.283 9.7 9.7 0 0 1 3.952-.826q2.365 0 4.507 1.111 2.14 1.112 3.683 3.214l-2.246 1.217q-1.153-1.472-2.74-2.253-1.572-.781-3.234-.781a7.2 7.2 0 0 0-3.009.646 8 8 0 0 0-2.5 1.802 8.6 8.6 0 0 0-1.692 2.673q-.614 1.516-.614 3.289 0 1.727.614 3.243a8.8 8.8 0 0 0 1.677 2.673 7.9 7.9 0 0 0 2.5 1.787 7.3 7.3 0 0 0 3.039.646q1.288 0 2.441-.435a7.5 7.5 0 0 0 2.141-1.232 7.7 7.7 0 0 0 1.676-1.877 8.5 8.5 0 0 0 1.063-2.373h-5.165v-2.252h8.1a10.7 10.7 0 0 1-.839 4.145 10.9 10.9 0 0 1-2.23 3.408 10.4 10.4 0 0 1-3.264 2.313 9.5 9.5 0 0 1-3.953.826" />
        <path fill="#FAFFFF" d="M117.93 151.266v-21.024h12.86v2.523h-10.345v5.977h8.474v2.523h-8.474v7.478h10.345v2.523z" />
        <path fill="#FAFFFF" d="M102.946 130.242v2.523h-6.977v18.501h-2.515v-18.501h-6.962v-2.523z" />
        <path fill="#FAFFFF" d="M55.813 151.266v-21.024h2.724l10.465 16.459v-16.459h2.516v21.024h-2.71l-10.48-16.459v16.459z" />
        <path fill="#FAFFFF" d="M37.266 151.266v-21.024h2.515v21.024z" />
        <defs fill="none">
          <linearGradient gradientUnits="userSpaceOnUse" y2="55.623" x2="378" y1="55.623" x1="0" id="pace-gradient">
            <stop stopColor="#F4FFF2" />
            <stop stopColor="#8AFFE4" offset=".072" />
            <stop stopColor="#A4FF2F" offset=".341" />
            <stop stopColor="#12C0FF" offset=".693" />
            <stop stopColor="#4FCEF0" offset=".869" />
            <stop stopColor="#F4FFF2" offset="1" />
          </linearGradient>
          <linearGradient gradientUnits="userSpaceOnUse" y2="-.617" x2="125.281" y1="4.26" x1="103.294" id="pace-accent">
            <stop stopOpacity="0" stopColor="#97BF47" offset=".28" />
            <stop stopColor="#204117" offset="1" />
          </linearGradient>
          <clipPath id="pace-gradient-clip">
            <path fill="#ffffff" d="M378 0v89.306H0V0z" />
          </clipPath>
        </defs>
      </g>
    </svg>
  );
}

function ChatApp() {
  const [conversationId, setConversationId] = useState(() => makeConversationId());
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(SAMPLE_PROMPT);
  const [debugMode, setDebugMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [promptSelections, setPromptSelections] = useState({});
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    contactMe: false,
  });

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
        flightPlanPdfDataUrl: assistantPayload.flightPlanPdfDataUrl,
        currentStep: assistantPayload.currentStep,
      };

      setPromptSelections({});
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

  const handleLeadSubmit = (event) => {
    event.preventDefault();

    const payload = JSON.stringify({
      name: leadForm.name.trim(),
      email: leadForm.email.trim(),
      contact_me: Boolean(leadForm.contactMe),
    });

    if (!payload || payload === '{}') {
      return;
    }

    sendMessage(payload);
  };

  const togglePromptSelection = (messageId, option) => {
    setPromptSelections((current) => {
      const next = { ...current };
      const selectionSet = new Set(next[messageId] || []);

      if (selectionSet.has(option)) {
        selectionSet.delete(option);
      } else {
        selectionSet.add(option);
      }

      const selectedOptions = Array.from(selectionSet);
      next[messageId] = selectedOptions;

      setInput((currentInput) => {
        const existingValues = currentInput
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);

        const currentPromptValues = Object.values(next).flatMap((items) => items || []);
        const preservedValues = existingValues.filter((value) => !currentPromptValues.includes(value) || value === option);
        const mergedValues = [...preservedValues, ...selectedOptions];

        return mergedValues.filter(Boolean).join(', ');
      });

      return next;
    });
  };

  return (
    <div className="app-shell">
      <div className="chat-window">
        <header className="topbar">
          <div className="brand-group">
            <PaceLogo />
            <div>
              <h1>AI Chat</h1>
              <p>Conversation ID: {conversationId}</p>
            </div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={debugMode} onChange={(event) => setDebugMode(event.target.checked)} />
            <span>Debug mode</span>
          </label>
        </header>

        <div className="messages-panel">
          {messages.length === 0 && (
            <div className="empty-state">
              <form className="lead-form" onSubmit={handleLeadSubmit}>
                <h2>Tell us a bit about you</h2>

                <label className="field-row">
                  <span>Name</span>
                  <input
                    type="text"
                    value={leadForm.name}
                    onChange={(event) => setLeadForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Jane Smith"
                    required
                  />
                </label>

                <label className="field-row">
                  <span>Email</span>
                  <input
                    type="email"
                    value={leadForm.email}
                    onChange={(event) => setLeadForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="jane@company.com"
                    required
                  />
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={leadForm.contactMe}
                    onChange={(event) => setLeadForm((current) => ({ ...current, contactMe: event.target.checked }))}
                  />
                  <span>I would like to be contacted in future</span>
                </label>

                <button type="submit" className="lead-submit" disabled={isLoading}>
                  Continue
                </button>
              </form>
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

                    {message.role === 'assistant' && message.flightPlanPdfDataUrl && (
                      <div className="pdf-attachment">
                        <object data={message.flightPlanPdfDataUrl} type="application/pdf" className="flight-plan-pdf-preview">
                          <a href={message.flightPlanPdfDataUrl} download="flightplan.pdf">Download flightplan.pdf</a>
                        </object>
                        <a href={message.flightPlanPdfDataUrl} download="flightplan.pdf" className="pdf-download-link">
                          Download flightplan.pdf
                        </a>
                      </div>
                    )}

                    {message.role === 'assistant' && Array.isArray(message.options) && message.options.length > 0 && (
                      <div className="prompt-list">
                        {message.options.map((option) => {
                          const isSelected = (promptSelections[message.id] || []).includes(option);

                          return (
                            <button
                              key={`${message.id}-${option}`}
                              type="button"
                              className={`prompt-chip ${isSelected ? 'selected' : ''}`}
                              onClick={() => togglePromptSelection(message.id, option)}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {message.role === 'assistant' && Number.isFinite(message.currentStep) && (
                      <div className="step-progress-wrapper" aria-label={`Progress step ${message.currentStep} of 5`}>
                        <div className="step-progress-track">
                          <div
                            className="step-progress-fill"
                            style={{ width: `${(message.currentStep / 5) * 100}%` }}
                          />
                        </div>
                        <span className="step-progress-label">Step {message.currentStep}/5</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message-row assistant">
              <div className="bubble assistant waiting">Thinking...</div>
            </div>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form className="composer" onSubmit={handleSubmit}>
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatApp />} />
        <Route path="/audit" element={<AuditPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
