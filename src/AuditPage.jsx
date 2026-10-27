import { useEffect, useMemo, useState } from 'react';

const AUDIT_API_URL = import.meta.env.VITE_AUDIT_API_URL || import.meta.env.AUDIT_API_URL || '';
const AUDIT_API_KEY = import.meta.env.VITE_AUDIT_API_KEY || import.meta.env.AUDIT_API_KEY || '';

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

function safeJsonParse(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
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

function buildConversationGroups(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = row?.conversation_id || 'unknown';
    const entry = grouped.get(key) || [];
    entry.push(row);
    grouped.set(key, entry);
  });

  return Array.from(grouped.entries()).map(([conversationId, conversationRows]) => {
    const sortedRows = [...conversationRows].sort((a, b) => {
      const aTime = new Date(a?.request_start_time || a?.request_end_time || 0).getTime();
      const bTime = new Date(b?.request_start_time || b?.request_end_time || 0).getTime();
      return aTime - bTime;
    });

    return {
      conversationId,
      rows: sortedRows,
      firstSeen: sortedRows[0]?.request_start_time || sortedRows[0]?.request_end_time || '',
      lastSeen: sortedRows[sortedRows.length - 1]?.request_end_time || sortedRows[sortedRows.length - 1]?.request_start_time || '',
      totalTokens: sortedRows.reduce((sum, row) => sum + (Number(row.usage_total_tokens) || 0), 0),
      requestCount: sortedRows.length,
    };
  });
}

function parseToolCallsValue(value) {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    const parsed = safeJsonParse(value);
    return parsed.filter((item) => item && typeof item === 'object');
  }

  if (typeof value === 'object') {
    return [value];
  }

  return [];
}

function summarizeToolParams(params) {
  if (!params || typeof params !== 'object') {
    return [];
  }

  return Object.entries(params).map(([key, value]) => ({
    key,
    value,
  }));
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

function formatDateLabel(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function formatHourLabel(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatDurationMs(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return '0s';
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function filterRowsByRange(rows, rangeKey) {
  if (!rows.length) return [];

  const allDates = rows.flatMap((row) => {
    const candidates = [row.request_start_time, row.request_end_time].filter(Boolean);
    return candidates.map((value) => new Date(value).getTime()).filter((time) => Number.isFinite(time));
  });

  if (!allDates.length) return rows;

  const maxDate = new Date(Math.max(...allDates));
  const rangeMsMap = {
    '1d': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const cutoff = maxDate.getTime() - (rangeMsMap[rangeKey] ?? rangeMsMap['7d']);
  return rows.filter((row) => {
    const start = row.request_start_time ? new Date(row.request_start_time).getTime() : null;
    const end = row.request_end_time ? new Date(row.request_end_time).getTime() : null;
    const timestamps = [start, end].filter((time) => Number.isFinite(time));
    return timestamps.some((time) => time >= cutoff && time <= maxDate.getTime());
  });
}

function buildDashboardMetrics(rows, rangeKey) {
  const filteredRows = filterRowsByRange(rows, rangeKey);

  if (!filteredRows.length) {
    return {
      totalRequests: 0,
      totalTokens: 0,
      avgDuration: 0,
      toolUsage: [],
      tokenSeries: [],
      executionSeries: [],
      durationSeries: [],
      conversations: 0,
    };
  }

  const toolCounts = new Map();
  const rangeMsMap = {
    '1d': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  const bucketMs = rangeKey === '1d' ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const allDates = filteredRows.flatMap((row) => {
    const candidates = [row.request_start_time, row.request_end_time].filter(Boolean);
    return candidates.map((value) => new Date(value).getTime()).filter((time) => Number.isFinite(time));
  });
  const maxDate = new Date(Math.max(...allDates));
  const rangeStart = new Date(maxDate.getTime() - (rangeMsMap[rangeKey] ?? rangeMsMap['7d']));
  const bucketMap = new Map();

  let totalTokens = 0;
  let totalDurationMs = 0;

  filteredRows.forEach((row) => {
    totalTokens += Number(row.usage_total_tokens) || 0;

    const start = row.request_start_time ? new Date(row.request_start_time) : null;
    const end = row.request_end_time ? new Date(row.request_end_time) : null;
    const durationMs = start && end ? Math.max(0, end.getTime() - start.getTime()) : 0;
    totalDurationMs += durationMs;

    parseToolCallsValue(row.tool_calls).forEach((toolCall) => {
      const toolName = toolCall?.name || 'unknown';
      toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
    });

    const metricDate = start || end || maxDate;
    const relativeTime = metricDate.getTime() - rangeStart.getTime();
    const bucketIndex = Math.max(0, Math.floor(relativeTime / bucketMs));
    const bucketTs = rangeStart.getTime() + (bucketIndex * bucketMs);
    const bucketDate = new Date(bucketTs);
    const bucketKey = bucketDate.toISOString();
    const bucketLabel = rangeKey === '1d' ? formatHourLabel(bucketDate) : formatDateLabel(bucketDate);

    const existingBucket = bucketMap.get(bucketKey) || { key: bucketKey, label: bucketLabel, value: 0, duration: 0 };
    existingBucket.value += Number(row.usage_total_tokens) || 0;
    existingBucket.duration += durationMs;
    bucketMap.set(bucketKey, existingBucket);
  });

  const tokenSeries = [...bucketMap.values()]
    .map((bucket) => ({ key: bucket.key, label: bucket.label, value: bucket.value }))
    .sort((a, b) => new Date(a.key).getTime() - new Date(b.key).getTime());

  const executionSeries = [...bucketMap.values()]
    .map((bucket) => ({ key: bucket.key, label: bucket.label, value: filteredRows.filter((row) => {
      const date = row.request_start_time ? new Date(row.request_start_time) : new Date(row.request_end_time || maxDate);
      const relativeTime = date.getTime() - rangeStart.getTime();
      const bucketIndex = Math.max(0, Math.floor(relativeTime / bucketMs));
      const bucketTs = rangeStart.getTime() + (bucketIndex * bucketMs);
      return bucket.key === new Date(bucketTs).toISOString();
    }).length }))
    .sort((a, b) => new Date(a.key).getTime() - new Date(b.key).getTime());

  const durationSeries = [...bucketMap.values()]
    .map((bucket) => ({ key: bucket.key, label: bucket.label, value: bucket.duration }))
    .sort((a, b) => new Date(a.key).getTime() - new Date(b.key).getTime());

  const toolUsage = [...toolCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    totalRequests: filteredRows.length,
    totalTokens,
    avgDuration: filteredRows.length ? totalDurationMs / filteredRows.length : 0,
    toolUsage,
    tokenSeries,
    executionSeries,
    durationSeries,
    conversations: new Set(filteredRows.map((row) => row.conversation_id).filter(Boolean)).size,
  };
}

function SimpleLineChart({ title, data, color, valueFormatter, maxValue }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!data || !data.length) {
    return (
      <div className="chart-card empty-chart">
        <h3>{title}</h3>
        <p>No data available.</p>
      </div>
    );
  }

  const width = 360;
  const height = 180;
  const padding = 18;
  const chartMax = maxValue ?? Math.max(...data.map((item) => item.value), 1);
  const chartMin = 0;

  const points = data.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
    const y = height - padding - ((item.value - chartMin) / Math.max(chartMax - chartMin, 1)) * (height - padding * 2);
    return { ...item, x, y };
  });

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPoints = `${linePoints} ${width - padding},${height - padding} ${padding},${height - padding}`;

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <div className="chart-wrapper">
        <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          <defs>
            <linearGradient id={`fill-${title.replace(/\s+/g, '-').toLowerCase()}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding + ratio * (height - padding * 2);
            return (
              <line
                key={`${title}-grid-${ratio}`}
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                stroke="rgba(148, 163, 184, 0.18)"
                strokeDasharray="4 4"
              />
            );
          })}

          <polygon points={areaPoints} fill={`url(#fill-${title.replace(/\s+/g, '-').toLowerCase()})`} />
          <polyline
            points={linePoints}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point) => (
            <g key={`${title}-${point.key || point.label}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={hoveredPoint && hoveredPoint.key === point.key ? 6 : 4}
                fill={color}
                className="chart-point"
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
              {point.label && (
                <text x={point.x} y={height - 2} textAnchor="middle" className="chart-label">
                  {point.label}
                </text>
              )}
            </g>
          ))}
        </svg>

        {hoveredPoint && (
          <div
            className="chart-point-tooltip"
            style={{
              left: `${(hoveredPoint.x / 360) * 100}%`,
              top: `${(hoveredPoint.y / 180) * 100}%`,
            }}
          >
            <span>{hoveredPoint.label}</span>
            <strong>{valueFormatter ? valueFormatter(hoveredPoint.value) : hoveredPoint.value}</strong>
          </div>
        )}
      </div>

      <div className="chart-summary-row">
        {points.slice(-2).map((point) => (
          <div key={`${title}-summary-${point.key || point.label}`} className="chart-summary-item">
            <span>{point.label}</span>
            <strong>{valueFormatter ? valueFormatter(point.value) : point.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolUsageChart({ toolUsage }) {
  if (!toolUsage || !toolUsage.length) {
    return (
      <div className="chart-card empty-chart">
        <h3>Most called tools</h3>
        <p>No tool activity recorded.</p>
      </div>
    );
  }

  const maxCount = Math.max(...toolUsage.map((tool) => tool.count), 1);

  return (
    <div className="chart-card">
      <h3>Most called tools</h3>
      <div className="tool-list" aria-label="Most called tools">
        {toolUsage.map((tool) => (
          <div key={tool.name} className="tool-row">
            <div className="tool-row-header">
              <span>{tool.name}</span>
              <strong>{tool.count}</strong>
            </div>
            <div className="tool-track">
              <div
                className="tool-fill"
                style={{ width: `${(tool.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('logs');
  const [selectedRange, setSelectedRange] = useState('7d');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedToolPayloads, setExpandedToolPayloads] = useState({});

  useEffect(() => {
    let isMounted = true;

    async function loadAuditLogs() {
      try {
        const response = await fetch(AUDIT_API_URL, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(AUDIT_API_KEY ? { Authorization: `Bearer ${AUDIT_API_KEY}` } : {}),
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

  const groupedRows = useMemo(() => buildConversationGroups(rows), [rows]);
  const dashboardMetrics = useMemo(() => buildDashboardMetrics(rows, selectedRange), [rows, selectedRange]);

  const toggleGroup = (conversationId) => {
    setExpandedGroups((current) => ({
      ...current,
      [conversationId]: !current[conversationId],
    }));
  };

  const toggleToolPayload = (conversationId, runtimeId) => {
    setExpandedToolPayloads((current) => ({
      ...current,
      [`${conversationId}:${runtimeId}`]: !current[`${conversationId}:${runtimeId}`],
    }));
  };

  return (
    <div className="app-shell">
      <div className="chat-window audit-page">
        <header className="topbar">
          <div>
            <h1>Audit Logs</h1>
            <p>Grouped by conversation_id</p>
          </div>
        </header>

        <div className="audit-tabs">
          <button
            type="button"
            className={`audit-tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            Logs
          </button>
          <button
            type="button"
            className={`audit-tab ${activeTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            Dashboard
          </button>

          {activeTab === 'metrics' && (
            <div className="audit-range-switch" aria-label="Select dashboard date range">
              {['1d', '7d', '30d'].map((range) => (
                <button
                  key={range}
                  type="button"
                  className={`audit-range-option ${selectedRange === range ? 'active' : ''}`}
                  onClick={() => setSelectedRange(range)}
                >
                  {range === '1d' ? '1 day' : range === '7d' ? '7 days' : '30 days'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="messages-panel audit-panel">
          {loading && <div className="empty-state"><p>Loading audit logs...</p></div>}

          {!loading && error && (
            <div className="error-banner" style={{ margin: 0 }}>
              {error}
            </div>
          )}

          {!loading && !error && activeTab === 'metrics' && (
            <div className="dashboard-view">
              <div className="kpi-grid">
                <div className="kpi-card">
                  <span>Total requests</span>
                  <strong>{formatCompactNumber(dashboardMetrics.totalRequests)}</strong>
                </div>
                <div className="kpi-card">
                  <span>Conversations</span>
                  <strong>{dashboardMetrics.conversations}</strong>
                </div>
                <div className="kpi-card">
                  <span>Total tokens</span>
                  <strong>{formatCompactNumber(dashboardMetrics.totalTokens)}</strong>
                </div>
                <div className="kpi-card">
                  <span>Avg duration</span>
                  <strong>{formatDurationMs(dashboardMetrics.avgDuration)}</strong>
                </div>
              </div>

              <div className="chart-grid">
                <ToolUsageChart toolUsage={dashboardMetrics.toolUsage} />
                <SimpleLineChart
                  title="Token usage over time"
                  data={dashboardMetrics.tokenSeries}
                  color="#60a5fa"
                  valueFormatter={(value) => formatCompactNumber(value)}
                />
                <SimpleLineChart
                  title="Executions over time"
                  data={dashboardMetrics.executionSeries}
                  color="#34d399"
                  valueFormatter={(value) => formatCompactNumber(value)}
                />
                <SimpleLineChart
                  title="Duration over time"
                  data={dashboardMetrics.durationSeries}
                  color="#fbbf24"
                  valueFormatter={(value) => formatDurationMs(value)}
                />
              </div>
            </div>
          )}

          {!loading && !error && activeTab === 'logs' && groupedRows.length === 0 && (
            <div className="empty-state">
              <p>No audit rows returned.</p>
            </div>
          )}

          {!loading && !error && activeTab === 'logs' && groupedRows.length > 0 && (
            <div className="audit-group-list">
              {groupedRows.map((group) => {
                const isExpanded = !!expandedGroups[group.conversationId];

                return (
                  <div key={group.conversationId} className="audit-group">
                    <button type="button" className="audit-group-header" onClick={() => toggleGroup(group.conversationId)}>
                      <div>
                        <div className="audit-group-title">Conversation</div>
                        <strong>{group.conversationId}</strong>
                      </div>
                      <div className="audit-group-meta">
                        <span>{group.requestCount} logs</span>
                        <span>{group.totalTokens} total tokens</span>
                        {group.firstSeen && <span>Start time: {group.firstSeen}</span>}
                        <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="audit-group-body">
                        {group.rows.map((row) => {
                          const toolCalls = parseToolCallsValue(row.tool_calls);
                          const hasTools = toolCalls.length > 0;

                          return (
                            <div key={row.runtime_id || `${group.conversationId}-${row.request_start_time}`} className="audit-log-item">
                              <div className="audit-log-summary">
                                <div>
                                  <div className="audit-label">Runtime ID</div>
                                  <div className="audit-value">{row.runtime_id || '—'}</div>
                                </div>
                                <div>
                                  <div className="audit-label">Model</div>
                                  <div className="audit-value">{row.usage_model || '—'}</div>
                                </div>
                                <div>
                                  <div className="audit-label">Request Type</div>
                                  <div className="audit-value">{row.usage_request_type || '—'}</div>
                                </div>
                                <div>
                                  <div className="audit-label">Tokens</div>
                                  <div className="audit-value">{row.usage_total_tokens || 0}</div>
                                </div>
                              </div>

                              <div className="audit-log-times">
                                <span><strong>Start:</strong> {row.request_start_time || '—'}</span>
                                <span><strong>End:</strong> {row.request_end_time || '—'}</span>
                              </div>

                              {hasTools ? (
                                <div className="tool-call-section">
                                  {toolCalls.map((toolCall, toolIndex) => {
                                    const toolName = toolCall?.name || `tool-${toolIndex + 1}`;
                                    const params = summarizeToolParams(toolCall?.params || {});
                                    const showPayload = !!expandedToolPayloads[`${group.conversationId}:${row.runtime_id}`];

                                    return (
                                      <div key={`${row.runtime_id}-${toolName}-${toolIndex}`} className="tool-card">
                                        <div className="tool-card-header">
                                          <strong>{toolName}</strong>
                                          <button
                                            type="button"
                                            className="tool-toggle"
                                            onClick={() => toggleToolPayload(group.conversationId, row.runtime_id)}
                                          >
                                            {showPayload ? 'Hide full payload' : 'Show full payload'}
                                          </button>
                                        </div>

                                        {params.length > 0 ? (
                                          <div className="tool-param-grid">
                                            {params.map(({ key, value }) => (
                                              <div key={`${toolName}-${key}`} className="tool-param-item">
                                                <div className="audit-label">{key}</div>
                                                <div className="audit-value">{toDisplayString(value)}</div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="audit-value">No parameters captured.</div>
                                        )}

                                        {showPayload && (
                                          <pre className="tool-payload">{JSON.stringify(toolCall, null, 2)}</pre>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="audit-value muted">No tool calls recorded.</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuditPage;
