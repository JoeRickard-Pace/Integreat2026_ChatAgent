export async function handler(event, context) {
  const TWO_MINUTES_MS = 120000;

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const conversationId = body.conversation_id;
    const message = body.message;

    if (!conversationId || !message) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'conversation_id and message are required' }),
      };
    }

    const upstreamUrl = process.env.CHAT_API_URL;
    const apiKey = process.env.CHAT_API_KEY;

    if (!upstreamUrl) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Missing CHAT_API_URL configuration' }),
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TWO_MINUTES_MS);

    try {
      const response = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ conversation_id: conversationId, message }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const text = await response.text();
      let payload;

      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text;
      }

      return {
        statusCode: response.ok ? 200 : response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(payload ?? { error: 'Empty response from upstream API' }),
      };
    } finally {
      clearTimeout(timeout);
    }

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: error.message || 'Unexpected server error' }),
    };
  }
}
