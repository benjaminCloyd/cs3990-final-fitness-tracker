import { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAuth }  from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { apiGetProgress } from '../api.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

function formatDate(date) {
  if (!date) return '';
  const [m, d, y] = date.split('/');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${months[+m - 1]} ${d}, ${y}`;
}

function uniqueExerciseNames(sessions) {
  const names = new Set();
  sessions.forEach((s) => s.exercises.forEach((ex) => names.add(ex.name)));
  return [...names].sort();
}

export default function ProgressPanel({ sessions }) {
  const { logout }    = useAuth();
  const { showToast } = useToast();

  const [active,  setActive]  = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const names = uniqueExerciseNames(sessions);

  async function selectExercise(name) {
    setActive(name);
    setLoading(true);
    try {
      const data = await apiGetProgress(name);
      setHistory(data);
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') { logout(); return; }
      showToast('Failed to load progress.', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Reload if active exercise still exists after session changes
  useEffect(() => {
    if (active && names.includes(active)) selectExercise(active);
    else if (active && !names.includes(active)) { setActive(null); setHistory([]); }
  }, [sessions]);

  const vals   = history.map((h) => h.best_1rm);
  const latest = vals.at(-1) ?? 0;
  const delta  = vals.length > 1 ? latest - vals[0] : 0;
  const peak   = vals.length ? Math.max(...vals) : 0;

  const chartData = {
    labels: history.map((h) => formatDate(h.date)),
    datasets: [{
      data: vals,
      borderColor: '#f5c518',
      backgroundColor: 'rgba(245,197,24,0.07)',
      borderWidth: 3,
      pointBackgroundColor: '#f5c518',
      pointBorderColor: '#0a0a0a',
      pointBorderWidth: 2,
      pointRadius: 7,
      tension: 0.3,
      fill: true,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a1a',
        borderColor: '#f5c518',
        borderWidth: 1,
        titleColor: '#f5c518',
        bodyColor: '#e8e8e8',
        titleFont: { family: 'Bebas Neue', size: 17 },
        bodyFont:  { family: 'JetBrains Mono', size: 12 },
        padding: 12,
        callbacks: { label: (c) => ` est. 1RM: ${c.parsed.y.toFixed(1)} lbs` },
      },
    },
    scales: {
      x: {
        grid:  { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#888', font: { family: 'JetBrains Mono', size: 12 } },
      },
      y: {
        grid:  { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#888', font: { family: 'JetBrains Mono', size: 12 }, callback: (v) => `${v} lbs` },
      },
    },
  };

  return (
    <div className="progress-panel">

      <div className="progress-header">
        <h2>1RM PROGRESS TRACKER</h2>
        <p className="subtitle">EPLEY FORMULA: 1RM = WEIGHT × (1 + REPS ÷ 30)</p>
      </div>

      {/* ── exercise pills ── */}
      <div>
        <div className="pill-label">SELECT EXERCISE</div>
        <div className="exercise-selector">
          {names.length === 0 ? (
            <span className="muted-text">Log exercises in sessions first.</span>
          ) : (
            names.map((n) => (
              <button
                key={n}
                className={`ex-pill ${active === n ? 'active' : ''}`}
                onClick={() => selectExercise(n)}
              >
                {n}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── stats ── */}
      {active && history.length > 0 && (
        <div className="stat-row">
          <StatBox value={latest.toFixed(1)} label="LATEST 1RM (LBS)" />
          <StatBox
            value={(delta >= 0 ? '+' : '') + delta.toFixed(1)}
            label="TOTAL CHANGE"
            color={delta >= 0 ? 'var(--green)' : 'var(--danger)'}
          />
          <StatBox value={peak.toFixed(1)} label="PEAK 1RM" />
          <StatBox value={history.length}  label="DATA POINTS" />
        </div>
      )}

      {/* ── chart ── */}
      <div className="chart-wrapper">
        {!active ? (
          <div className="no-data-chart"><span>SELECT AN EXERCISE ABOVE</span></div>
        ) : loading ? (
          <div className="no-data-chart"><span>LOADING…</span></div>
        ) : history.length === 0 ? (
          <div className="no-data-chart"><span>NO DATA FOR {active.toUpperCase()}</span></div>
        ) : (
          <>
            <div className="chart-title">{active.toUpperCase()}</div>
            <div className="chart-subtitle">ESTIMATED ONE-REP MAX OVER TIME // LBS</div>
            <div className="canvas-container">
              <Line data={chartData} options={chartOptions} />
            </div>
          </>
        )}
      </div>

    </div>
  );
}

function StatBox({ value, label, color }) {
  return (
    <div className="stat-box">
      <div className="stat-val" style={color ? { color } : {}}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
