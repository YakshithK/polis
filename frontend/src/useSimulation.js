import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ||
  (window.location.origin.includes('localhost') ? 'http://localhost:8000' : window.location.origin);

export function useSimulation() {
  const [sessionId, setSessionId] = useState(null);
  const [districts, setDistricts] = useState({});
  const [feedEntries, setFeedEntries] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [autopilotStatus, setAutopilotStatus] = useState('idle');
  const [eventLog, setEventLog] = useState([]);
  const [matchMinute, setMatchMinute] = useState(0);
  const [connectionError, setConnectionError] = useState(null);
  const wsRef = useRef(null);
  const sessionIdRef = useRef(null);
  const retryTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const handleMessage = useCallback((e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'snapshot' || msg.type === 'update') {
      setDistricts(prev => {
        const next = { ...prev };
        msg.districts.forEach(d => { next[d.district_id] = d; });
        return next;
      });
      if (msg.type === 'update') {
        setLastEvent(msg.event);
        setEventLog(prev => [...prev, { ...msg.event, ts: Date.now() }].slice(-50));
      }
    }
    if (msg.type === 'tick') {
      setMatchMinute(msg.minute);
      setDistricts(prev => {
        const next = { ...prev };
        msg.districts.forEach(d => { next[d.district_id] = d; });
        return next;
      });
    }
    if (msg.type === 'feed') {
      setFeedEntries(prev => [msg, ...prev].slice(0, 50));
    }
    if (msg.type === 'autopilot') {
      setAutopilotStatus(msg.status);
      if (msg.status === 'running') setMatchMinute(0);
    }
  }, []);

  const openWs = useCallback((sid) => {
    if (!mountedRef.current) return;
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = API_BASE.replace(/^https?:\/\//, '');
    const ws = new WebSocket(`${wsProto}//${wsHost}/ws/${sid}`);
    wsRef.current = ws;
    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      setConnectionError(null);
    };
    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      // Reconnect to same session after 2s
      retryTimerRef.current = setTimeout(() => openWs(sid), 2000);
    };
    ws.onmessage = handleMessage;
  }, [handleMessage]);

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      setConnectionError(null);
      const res = await fetch(`${API_BASE}/session/`, { method: 'POST' });
      if (!res.ok) throw new Error(`Backend returned HTTP ${res.status}`);
      const session = await res.json();
      if (!mountedRef.current) return;
      setSessionId(session.session_id);
      sessionIdRef.current = session.session_id;
      openWs(session.session_id);
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = `Cannot reach backend at ${API_BASE} — ${err.message}`;
      setConnectionError(msg);
      console.error('[Algopolis]', msg);
      // Retry session creation after 3s
      retryTimerRef.current = setTimeout(connect, 3000);
    }
  }, [openWs]);

  const injectEvent = useCallback(async (type, team) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    await fetch(`${API_BASE}/session/${sid}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, team, minute: matchMinute, severity: 0.8 }),
    });
  }, [matchMinute]);

  const triggerAutopilot = useCallback(async (action, strictness = 'conservative') => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    await fetch(`${API_BASE}/session/${sid}/autopilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, strictness }),
    });
    if (action === 'stop') setAutopilotStatus('idle');
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { sessionId, districts, feedEntries, connected, connectionError, injectEvent, lastEvent, autopilotStatus, triggerAutopilot, eventLog, matchMinute };
}
