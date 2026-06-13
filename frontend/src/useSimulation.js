import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export function useSimulation() {
  const [sessionId, setSessionId] = useState(null);
  const [districts, setDistricts] = useState({});
  const [feedEntries, setFeedEntries] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [autopilotStatus, setAutopilotStatus] = useState('idle'); // idle | generating | running | finished
  const wsRef = useRef(null);

  const connect = useCallback(async () => {
    // Create session
    const res = await fetch(`${API_BASE}/session/`, { method: 'POST' });
    const session = await res.json();
    setSessionId(session.session_id);

    // Open WebSocket
    const wsUrl = `ws://localhost:8000/ws/${session.session_id}`;
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
        if (msg.type === 'update') setLastEvent(msg.event);
      }
      if (msg.type === 'feed') {
        setFeedEntries(prev => [msg, ...prev].slice(0, 50));
      }
      if (msg.type === 'autopilot') {
        setAutopilotStatus(msg.status);
      }
    };

    return session.session_id;
  }, []);

  const injectEvent = useCallback(async (type, team) => {
    if (!sessionId) return;
    await fetch(`${API_BASE}/session/${sessionId}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, team, minute: 45, severity: 0.8 }),
    });
  }, [sessionId]);

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

  return { sessionId, districts, feedEntries, connected, injectEvent, lastEvent, autopilotStatus, triggerAutopilot };
}
