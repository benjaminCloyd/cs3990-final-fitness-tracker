import { useState } from 'react';

export default function LandingPage({ onSelect }) {
  const [hovered, setHovered] = useState(null); // 'sessions' | 'recipes' | null

  return (
    <div className="hub-root">
      <div className="hub-wordmark">Fitness Tracker</div>

      <div className="hub-split">
        {/* ── LEFT: IRON ── */}
        <div
          className={`hub-half hub-half--iron ${hovered === 'sessions' ? 'hub-half--active' : ''} ${hovered === 'recipes' ? 'hub-half--dim' : ''}`}
          onClick={() => onSelect('sessions')}
          onMouseEnter={() => setHovered('sessions')}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="hub-half-bg hub-half-bg--iron" />
          <div className="hub-half-noise" />
          <div className="hub-half-content">
            <div className="hub-half-tag">MODULE 01</div>
            <div className="hub-half-title">LIFTING</div>
            <div className="hub-half-sub">TRACK YOUR LIFTS</div>
            <div className="hub-half-items">
              <span>→ WORKOUT SESSIONS</span>
              <span>→ 1RM PROGRESS</span>
              <span>→ EXERCISE HISTORY</span>
            </div>
            <div className="hub-half-cta">
              <span className="hub-cta-text">ENTER</span>
              <span className="hub-cta-arrow">→</span>
            </div>
          </div>
          <div className="hub-half-number hub-half-number--iron">01</div>
        </div>

        {/* ── DIVIDER ── */}
        <div className="hub-divider">
          <div className="hub-divider-line" />
          <div className="hub-divider-or">OR</div>
          <div className="hub-divider-line" />
        </div>

        {/* ── RIGHT: FUEL ── */}
        <div
          className={`hub-half hub-half--fuel ${hovered === 'recipes' ? 'hub-half--active' : ''} ${hovered === 'sessions' ? 'hub-half--dim' : ''}`}
          onClick={() => onSelect('recipes')}
          onMouseEnter={() => setHovered('recipes')}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="hub-half-bg hub-half-bg--fuel" />
          <div className="hub-half-noise" />
          <div className="hub-half-content">
            <div className="hub-half-tag">MODULE 02</div>
            <div className="hub-half-title hub-half-title--fuel">RECIPES</div>
            <div className="hub-half-sub hub-half-sub--fuel">TRACK YOUR DIET</div>
            <div className="hub-half-items hub-half-items--fuel">
              <span>→ RECIPE LIBRARY</span>
              <span>→ MEAL PLANNING</span>
              <span>→ MACRO TARGETS</span>
            </div>
            <div className="hub-half-cta hub-half-cta--fuel">
              <span className="hub-cta-text">ENTER</span>
              <span className="hub-cta-arrow">→</span>
            </div>
          </div>
          <div className="hub-half-number hub-half-number--fuel">02</div>
        </div>
      </div>

      <style>{`
        .hub-root {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          background: #0a0a0a;
        }

        .hub-wordmark {
          position: absolute;
          top: 28px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.1rem;
          letter-spacing: 10px;
          color: #333;
          z-index: 10;
          pointer-events: none;
        }

        .hub-split {
          display: flex;
          flex: 1;
          height: 100%;
          position: relative;
        }

        /* ── EACH HALF ── */
        .hub-half {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          overflow: hidden;
          transition: flex 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .hub-half--active { flex: 1.35; }
        .hub-half--dim    { flex: 0.65; }

        /* Backgrounds */
        .hub-half-bg {
          position: absolute;
          inset: 0;
          transition: opacity 0.4s;
        }
        .hub-half-bg--iron {
          background: radial-gradient(ellipse at 30% 60%, rgba(245,197,24,0.08) 0%, transparent 65%);
        }
        .hub-half-bg--fuel {
          background: radial-gradient(ellipse at 70% 60%, rgba(39,174,96,0.08) 0%, transparent 65%);
        }
        .hub-half--active .hub-half-bg--iron {
          background: radial-gradient(ellipse at 30% 60%, rgba(245,197,24,0.15) 0%, transparent 65%);
        }
        .hub-half--active .hub-half-bg--fuel {
          background: radial-gradient(ellipse at 70% 60%, rgba(39,174,96,0.14) 0%, transparent 65%);
        }

        /* Noise overlay for texture */
        .hub-half-noise {
          position: absolute;
          inset: 0;
          opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 150px;
          pointer-events: none;
        }

        /* Content */
        .hub-half-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 40px;
          user-select: none;
        }

        .hub-half-tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.65rem;
          color: #444;
          letter-spacing: 4px;
        }

        .hub-half-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(5rem, 10vw, 9rem);
          letter-spacing: 10px;
          line-height: 0.9;
          color: #f5c518;
          text-shadow: 0 0 80px rgba(245,197,24,0.15);
          transition: text-shadow 0.3s, letter-spacing 0.4s;
        }
        .hub-half-title--fuel {
          color: #27ae60;
          text-shadow: 0 0 80px rgba(39,174,96,0.15);
        }
        .hub-half--active .hub-half-title {
          text-shadow: 0 0 120px rgba(245,197,24,0.35);
          letter-spacing: 14px;
        }
        .hub-half--active .hub-half-title--fuel {
          text-shadow: 0 0 120px rgba(39,174,96,0.3);
        }

        .hub-half-sub {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.85rem;
          letter-spacing: 6px;
          color: #555;
          margin-top: -10px;
          transition: color 0.3s;
        }
        .hub-half-sub--fuel { color: #3a5a3a; }
        .hub-half--active .hub-half-sub    { color: #888; }
        .hub-half--active .hub-half-sub--fuel { color: #4a7a4a; }

        .hub-half-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 8px;
          opacity: 0;
          transform: translateX(-12px);
          transition: opacity 0.35s 0.1s, transform 0.35s 0.1s;
        }
        .hub-half-items--fuel {
          transform: translateX(12px);
        }
        .hub-half--active .hub-half-items {
          opacity: 1;
          transform: translateX(0);
        }
        .hub-half-items span {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
          color: #666;
          letter-spacing: 2px;
        }
        .hub-half-items--fuel span { color: #3d6b3d; }
        .hub-half--active .hub-half-items span { color: #888; }
        .hub-half--active .hub-half-items--fuel span { color: #5a9a5a; }

        .hub-half-cta {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          padding: 14px 24px;
          border: 2px solid rgba(245,197,24,0.3);
          width: fit-content;
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.3s 0.15s, transform 0.3s 0.15s, background 0.2s, border-color 0.2s;
        }
        .hub-half-cta--fuel {
          border-color: rgba(39,174,96,0.3);
        }
        .hub-half--active .hub-half-cta {
          opacity: 1;
          transform: translateY(0);
        }
        .hub-half-cta:hover {
          background: rgba(245,197,24,0.08);
          border-color: rgba(245,197,24,0.7);
        }
        .hub-half-cta--fuel:hover {
          background: rgba(39,174,96,0.08);
          border-color: rgba(39,174,96,0.7);
        }

        .hub-cta-text {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.1rem;
          letter-spacing: 4px;
          color: #f5c518;
        }
        .hub-half-cta--fuel .hub-cta-text { color: #27ae60; }

        .hub-cta-arrow {
          font-family: 'JetBrains Mono', monospace;
          color: #f5c518;
          transition: transform 0.2s;
        }
        .hub-half-cta--fuel .hub-cta-arrow { color: #27ae60; }
        .hub-half-cta:hover .hub-cta-arrow { transform: translateX(4px); }

        /* Big background number */
        .hub-half-number {
          position: absolute;
          bottom: -20px;
          right: 20px;
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(8rem, 18vw, 18rem);
          line-height: 1;
          color: rgba(245,197,24,0.03);
          pointer-events: none;
          z-index: 1;
          transition: color 0.4s, transform 0.5s;
          user-select: none;
        }
        .hub-half-number--fuel {
          right: auto;
          left: 20px;
          color: rgba(39,174,96,0.03);
        }
        .hub-half--active .hub-half-number--iron { color: rgba(245,197,24,0.06); transform: scale(1.05); }
        .hub-half--active .hub-half-number--fuel  { color: rgba(39,174,96,0.06);  transform: scale(1.05); }

        /* Top accent line */
        .hub-half::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hub-half--iron::after { background: #f5c518; }
        .hub-half--fuel::after  { background: #27ae60; }
        .hub-half--active::after { transform: scaleX(1); }

        /* Divider */
        .hub-divider {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          height: 200px;
          pointer-events: none;
          transition: opacity 0.3s;
        }
        .hub-divider-line {
          width: 1px;
          flex: 1;
          background: linear-gradient(to bottom, transparent, #2a2a2a, transparent);
        }
        .hub-divider-or {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.6rem;
          color: #333;
          letter-spacing: 3px;
          padding: 6px 0;
        }

        /* Border between halves */
        .hub-half--iron {
          border-right: 1px solid #1a1a1a;
        }
      `}</style>
    </div>
  );
}