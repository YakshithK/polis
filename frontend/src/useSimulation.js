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
  const [activityEntries, setActivityEntries] = useState([]);
  const [activityByDistrict, setActivityByDistrict] = useState({});
  const [matchMinute, setMatchMinute] = useState(0);
  const [connectionError, setConnectionError] = useState(null);
  const wsRef = useRef(null);
  const sessionIdRef = useRef(null);
  const retryTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const seenEventKeysRef = useRef(new Set());
  // Always points to the current connect() — avoids stale-closure bugs in WS handlers
  const connectRef = useRef(null);

  const handleMessage = useCallback((e) => {
    const msg = JSON.parse(e.data);
    // Backend has no active engine for this session — create a fresh one
    if (msg.type === 'no_session') {
      setTimeout(() => connectRef.current?.(), 500);
      return;
    }
    if (msg.type === 'snapshot' || msg.type === 'update') {
      setDistricts(prev => {
        const next = { ...prev };
        msg.districts.forEach(d => { next[d.district_id] = d; });
        return next;
      });
      if (msg.type === 'update') {
        // Deduplicate: same event type+minute within 3s means a duplicate broadcast
        const dedupKey = `${msg.event.type}-${msg.event.minute}-${msg.source ?? ''}`;
        if (seenEventKeysRef.current.has(dedupKey)) return;
        seenEventKeysRef.current.add(dedupKey);
        setTimeout(() => seenEventKeysRef.current.delete(dedupKey), 3000);

        setLastEvent(msg.event);
        setEventLog(prev => [...prev, { ...msg.event, source: msg.source ?? 'autopilot', ts: Date.now() }].slice(-50));
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
    if (msg.type === 'activity') {
      setActivityByDistrict(msg.districts ?? {});
      const entries = Object.entries(msg.districts ?? {}).flatMap(([district, payload]) => {
        const archetype = payload?.archetype ?? '';
        return (payload?.citizens ?? []).slice(0, 3).map(item => ({
          type: 'activity',
          district,
          citizen: item.citizen,
          text: item.activity,
          archetype,
          ts: Date.now(),
        }));
      });
      setActivityEntries(prev => [...entries, ...prev].slice(0, 60));
    }
    if (msg.type === 'autopilot') {
      setAutopilotStatus(msg.status);
      if (msg.status === 'running') setMatchMinute(0);
    }
  }, []);

  const openWs = useCallback((sid) => {
    if (!mountedRef.current) return;
    // Tear down the old socket before opening a new one — prevents duplicate
    // message handlers when React StrictMode or reconnects create a second socket
    const prev = wsRef.current;
    if (prev) {
      prev.onclose = null;   // suppress the reconnect timer
      prev.onmessage = null; // stop duplicate event delivery immediately
      if (prev.readyState < 2) prev.close();
    }
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = API_BASE.replace(/^https?:\/\//, '');
    const ws = new WebSocket(`${wsProto}//${wsHost}/ws/${sid}`);
    wsRef.current = ws;
    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      setConnectionError(null);
    };
    ws.onclose = (event) => {
      if (!mountedRef.current) return;
      setConnected(false);
      // code 1006 = abnormal (server down/restart) → need a fresh session
      // code 4000 = backend sent no_session → handleMessage already triggered connect
      // any other code = normal drop → reconnect to same session
      if (event.code === 1006) {
        retryTimerRef.current = setTimeout(() => connectRef.current?.(), 2000);
      } else if (event.code !== 4000) {
        retryTimerRef.current = setTimeout(() => openWs(sid), 2000);
      }
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
      retryTimerRef.current = setTimeout(() => connectRef.current?.(), 3000);
    }
  }, [openWs]);
  // Keep ref current so closures in WS handlers always get the latest connect
  connectRef.current = connect;

  const injectEvent = useCallback(async (type, team) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    await fetch(`${API_BASE}/session/${sid}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, team, minute: matchMinute, severity: 1.0 }),
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

  const [nlState, setNLState] = useState('idle');
  const [interpretation, setInterpretation] = useState(null);

  const submitNaturalEvent = useCallback(async (text) => {
    const sid = sessionIdRef.current;
    if (!sid || !text.trim()) return;
    setNLState('interpreting');
    try {
      const res = await fetch(`${API_BASE}/session/${sid}/event/natural`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setInterpretation(data.interpreted_as);
      setNLState('interpreted');
      setTimeout(() => {
        setNLState('idle');
        setInterpretation(null);
      }, 2000);
    } catch {
      setNLState('idle');
    }
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

  return { sessionId, districts, feedEntries, activityEntries, activityByDistrict, connected, connectionError, injectEvent, lastEvent, autopilotStatus, triggerAutopilot, eventLog, matchMinute, nlState, interpretation, submitNaturalEvent };
}
