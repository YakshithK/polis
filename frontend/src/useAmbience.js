import { useRef, useCallback, useEffect } from 'react';

// Crossfade thresholds
const CHEER_START = 40;   // excitement below this: baseline only
const CHEER_FULL  = 70;   // excitement above this: full cheer mix
const FADE_TIME   = 0.8;  // seconds for gain transitions
const SILENCE     = 0.05; // residual volume after elimination (never truly 0 — avoids Web Audio click)

export function useAmbience() {
  const ctx        = useRef(null);
  const baseSource = useRef(null);
  const cheerSource= useRef(null);
  const baseGain   = useRef(null);
  const cheerGain  = useRef(null);
  const loaded     = useRef(false);
  const eliminated = useRef(false);

  const loadBuffer = useCallback(async (url) => {
    const resp = await fetch(url);
    const arr  = await resp.arrayBuffer();
    return ctx.current.decodeAudioData(arr);
  }, []);

  const start = useCallback(async () => {
    if (loaded.current) return;

    ctx.current = new (window.AudioContext || window.webkitAudioContext)();
    const ac = ctx.current;

    // Load all three clips in parallel
    const [baseBuf, cheerBuf, groanBuf] = await Promise.all([
      loadBuffer('/audio/baseline.mp3'),
      loadBuffer('/audio/cheer.mp3'),
      loadBuffer('/audio/groan.mp3'),
    ]);

    // Gain nodes
    baseGain.current  = ac.createGain();
    cheerGain.current = ac.createGain();
    baseGain.current.gain.value  = 1.0;
    cheerGain.current.gain.value = 0.0;
    baseGain.current.connect(ac.destination);
    cheerGain.current.connect(ac.destination);

    // Looping sources
    baseSource.current  = ac.createBufferSource();
    cheerSource.current = ac.createBufferSource();
    baseSource.current.buffer  = baseBuf;
    cheerSource.current.buffer = cheerBuf;
    baseSource.current.loop  = true;
    cheerSource.current.loop = true;
    baseSource.current.connect(baseGain.current);
    cheerSource.current.connect(cheerGain.current);

    // Store groan buffer for one-shot playback
    ac._groanBuf = groanBuf;

    baseSource.current.start();
    cheerSource.current.start();
    loaded.current = true;
  }, [loadBuffer]);

  const setAmbience = useCallback((excitement) => {
    if (!loaded.current || eliminated.current) return;
    const ac = ctx.current;
    const now = ac.currentTime;

    // Clamp and compute target gains
    const t = Math.max(0, Math.min(1, (excitement - CHEER_START) / (CHEER_FULL - CHEER_START)));
    const targetCheer = t * 0.9;
    const targetBase  = 1.0 - t * 0.6;  // never fully muted — keeps crowd texture

    baseGain.current.gain.cancelScheduledValues(now);
    cheerGain.current.gain.cancelScheduledValues(now);
    baseGain.current.gain.linearRampToValueAtTime(targetBase,  now + FADE_TIME);
    cheerGain.current.gain.linearRampToValueAtTime(targetCheer, now + FADE_TIME);
  }, []);

  const triggerGroan = useCallback(() => {
    if (!loaded.current) return;
    const ac = ctx.current;
    const now = ac.currentTime;

    // One-shot groan
    const groanSrc = ac.createBufferSource();
    groanSrc.buffer = ac._groanBuf;
    const groanGain = ac.createGain();
    groanGain.gain.value = 1.0;
    groanSrc.connect(groanGain);
    groanGain.connect(ac.destination);
    groanSrc.start();

    // Fade everything to near-silence after 2s
    eliminated.current = true;
    setTimeout(() => {
      const t = ac.currentTime;
      baseGain.current.gain.linearRampToValueAtTime(SILENCE, t + 3.0);
      cheerGain.current.gain.linearRampToValueAtTime(0,       t + 3.0);
    }, 2000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      baseSource.current?.stop();
      cheerSource.current?.stop();
      ctx.current?.close();
    };
  }, []);

  return { start, setAmbience, triggerGroan };
}
