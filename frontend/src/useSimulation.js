import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 
  (window.location.origin.includes('localhost') ? 'http://localhost:8000' : window.location.origin);

export function useSimulation() {
  const [sessionId, setSessionId] = useState(null);
  const [districts, setDistricts] = useState({});
  const [feedEntries, setFeedEntries] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [autopilotStatus, setAutopilotStatus] = useState('idle'); // idle | generating | running | finished
  const [eventLog, setEventLog] = useState([]); // [{type, team, minute, severity, ts}]
  const [matchMinute, setMatchMinute] = useState(0);
  const wsRef = useRef(null);

  const connect = useCallback(async () => {
    // Create session
    const res = await fetch(`${API_BASE}/session/`, { method: 'POST' });
    const session = await res.json();
    setSessionId(session.session_id);

    // Open WebSocket dynamically
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = API_BASE.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProto}//${wsHost}/ws/${session.session_id}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (e) => {
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
        if (msg.status === 'running') {
          setMatchMinute(0);
        }
      }
    };

    return session.session_id;
  }, []);

  const injectEvent = useCallback(async (type, team) => {
    if (!sessionId) return;
    await fetch(`${API_BASE}/session/${sessionId}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, team, minute: matchMinute, severity: 0.8 }),
    });
  }, [sessionId, matchMinute]);

  const triggerAutopilot = useCallback(async (action, strictness = 'conservative') => {
    if (!sessionId) return;
    await fetch(`${API_BASE}/session/${sessionId}/autopilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, strictness }),
    });
    if (action === 'stop') setAutopilotStatus('idle');
  }, [sessionId]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, []);

  return { sessionId, districts, feedEntries, connected, injectEvent, lastEvent, autopilotStatus, triggerAutopilot, eventLog, matchMinute };
}
