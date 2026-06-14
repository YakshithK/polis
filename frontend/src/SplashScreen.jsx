import { useState, useEffect, useRef } from 'react';

export default function SplashScreen({ onStart }) {
  const [hiding, setHiding] = useState(false);
  const [visible, setVisible] = useState(false);
  const canvasRef = useRef(null);
  const dotsRef = useRef([]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    dotsRef.current = Array.from({ length: 600 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
    }));

    let rafId;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8';
      dotsRef.current.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > canvas.width)  d.vx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
        ctx.fillRect(d.x, d.y, 3, 3);
      });
      rafId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleStart = () => {
    setHiding(true);
    setTimeout(onStart, 500);
  };

  return (
    <div className={`splash-screen${hiding ? ' splash-out' : ''}`}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, opacity: 0.5 }}
        aria-hidden
      />

      <div className={`splash-body${visible ? ' splash-body-in' : ''}`}>
        <div className="splash-eyebrow">World Cup 2026 · Toronto</div>

        <h1 className="splash-name">
          <span className="splash-name-algo">Algo</span>polis
        </h1>

        <p className="splash-line">The city reacts. Live.</p>

        <button className="splash-btn" onClick={handleStart}>
          Start →
        </button>
      </div>
    </div>
  );
}
