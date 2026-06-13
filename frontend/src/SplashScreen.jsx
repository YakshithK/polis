import { useState, useEffect } from 'react';

export default function SplashScreen({ onStart }) {
  const [hiding, setHiding] = useState(false);
  const [visible, setVisible] = useState(false);

  // Stagger content in after mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleStart = () => {
    setHiding(true);
    setTimeout(onStart, 500);
  };

  return (
    <div className={`splash-screen${hiding ? ' splash-out' : ''}`}>
      {/* Dot grid background */}
      <div className="splash-grid" aria-hidden />

      {/* Center content */}
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
