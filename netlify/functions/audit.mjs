export async function handler(event) {
  const TWO_MINUTES_MS = 120000;

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed. This endpoint requires GET.' }),
    };
  }

  try {
    const upstreamUrl = process.env.AUDIT_API_URL;
    const apiKey = process.env.AUDIT_API_KEY;

    if (!upstreamUrl) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Missing AUDIT_API_URL configuration' }),
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TWO_MINUTES_MS);

    try {
      const response = await fetch(upstreamUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        signal: controller.signal,
      });

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
