import { useEffect, useMemo, useState } from 'react';

const AUDIT_API_URL = import.meta.env.DEV ? '/audit-data' : '/.netlify/functions/audit';

function toDisplayString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => toDisplayString(item)).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }
  return String(value);
}

function flattenAuditRows(payload) {
  if (Array.isArray(payload)) {
    const flattened = payload.flatMap((item) => {
      if (item && typeof item === 'object' && Array.isArray(item.audit)) {
        return item.audit;
      }
      return item && typeof item === 'object' ? [item] : [];
    });

    return flattened.filter((item) => item && typeof item === 'object');
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload.audit)) {
    return payload.audit.filter((item) => item && typeof item === 'object');
  }

  const candidates = [
    payload.rows,
    payload.records,
    payload.data,
    payload.results,
    payload.items,
    payload.logs,
    payload.auditLogs,
    payload.response?.rows,
    payload.response?.records,
    payload.response?.data,
    payload.response?.results,
    payload.response?.audit,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item) => item && typeof item === 'object');
    }
  }

  const nested = Object.values(payload).find((value) => Array.isArray(value) && value.some((entry) => entry && typeof entry === 'object'));
  if (Array.isArray(nested)) {
    return nested.filter((item) => item && typeof item === 'object');
  }

  return [];
}

function AuditPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadAuditLogs() {
      try {
        const response = await fetch(AUDIT_API_URL, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();
        let parsed;

        try {
          parsed = contentType.includes('application/json') ? JSON.parse(text) : text;
        } catch {
          parsed = text;
        }

        if (!response.ok) {
          const detail = parsed?.error || parsed?.message || parsed?.response_map?.error_list?.[0]?.response_map?.error_list?.[0]?.message || JSON.stringify(parsed, null, 2) || 'Unknown backend error';
          throw new Error(detail);
        }

        const auditRows = flattenAuditRows(parsed);

        if (isMounted) {
          setRows(auditRows);
          setError('');
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load audit logs.');
          setRows([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAuditLogs();

    return () => {
      isMounted = false;
    };
  }, []);

  const columns = useMemo(() => {
    const keys = new Set();
    rows.forEach((row) => {
      Object.keys(row || {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [rows]);

  return (
    <div className="app-shell">
      <div className="chat-window audit-page">
        <header className="topbar">
          <div>
            <h1>Audit Logs</h1>
            <p>Direct route: /audit</p>
          </div>
        </header>

        <div className="messages-panel audit-panel">
          {loading && <div className="empty-state"><p>Loading audit logs...</p></div>}

          {!loading && error && (
            <div className="error-banner" style={{ margin: 0 }}>
              {error}
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="empty-state">
              <p>No audit rows returned.</p>
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${index}-${Object.keys(row || {}).join('-')}`}>
                      {columns.map((column) => (
                        <td key={`${index}-${column}`}>{toDisplayString(row?.[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuditPage;
