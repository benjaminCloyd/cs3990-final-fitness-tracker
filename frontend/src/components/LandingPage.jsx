export default function LandingPage({ onSelect }) {
  return (
    <div className="hub-layout">
      <div className="hub-eyebrow">SELECT MODULE</div>

      <div className="hub-cards">
        <HubCard
          onClick={() => onSelect('sessions')}
          title="IRON"
          accent="var(--accent)"
          tags={['SESSIONS', 'PROGRESS']}
          desc="Log workouts, track sets and reps, and monitor estimated 1RM progress over time."
        />
        <HubCard
          onClick={() => onSelect('recipes')}
          title="FUEL"
          accent="var(--green)"
          tags={['RECIPES', 'MEAL PLANS']}
          desc="Build a recipe library, plan weekly meals, and hit your daily macro targets."
        />
      </div>
    </div>
  );
}

function HubCard({ onClick, title, accent, tags, desc }) {
  return (
    <div className="hub-card" onClick={onClick} style={{ '--card-accent': accent }}>
      <div className="hub-card-top-bar" />
      <div className="hub-card-label">MODULE</div>
      <div className="hub-card-title" style={{ color: accent }}>{title}</div>
      <div className="hub-card-tags">
        {tags.map(t => <span key={t} className="hub-tag">{t}</span>)}
      </div>
      <p className="hub-card-desc">{desc}</p>
      <div className="hub-card-enter">ENTER →</div>
    </div>
  );
}