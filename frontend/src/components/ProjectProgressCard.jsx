import { useEffect, useRef } from 'react';

export default function ProjectProgressCard({ project }) {
  const phases = project?.phases || [];
  const overall = project?.overall_completion ?? 0;
  const radius = 54;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (overall / 100) * circumference;

  const PHASE_COLORS = [
    '#4F8EF7', '#8B5CF6', '#14B8A6', '#22C55E', '#F59E0B', '#EF4444',
  ];

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h3 style={{ marginBottom: '0.2rem' }}>{project.name}</h3>
            <span className={`badge badge-${project.status}`}>{project.status?.replace('_', ' ')}</span>
          </div>
          {project.deadline && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Due {new Date(project.deadline).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <div className="card-body">
        <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
          {/* Circular Progress Ring */}
          <div className="progress-ring-wrapper">
            <svg width={130} height={130} viewBox="0 0 130 130">
              {/* Background ring */}
              <circle
                cx="65" cy="65" r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={stroke}
              />
              {/* Progress arc */}
              <circle
                cx="65" cy="65" r={radius}
                fill="none"
                stroke="url(#blueGrad)"
                strokeWidth={stroke}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
              />
              <defs>
                <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4F8EF7" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              {/* Center text */}
              <text x="65" y="61" textAnchor="middle" fill="#F0F4FF" fontSize="20" fontWeight="800" fontFamily="Inter,sans-serif">
                {Math.round(overall)}%
              </text>
              <text x="65" y="77" textAnchor="middle" fill="rgba(240,244,255,0.4)" fontSize="10" fontFamily="Inter,sans-serif">
                complete
              </text>
            </svg>
          </div>

          {/* Phase breakdown */}
          <div style={{ flex: 1, minWidth: 180 }}>
            {phases.length === 0 ? (
              <p style={{ fontSize: '0.8rem' }}>No phases defined</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {phases.map((phase, i) => (
                  <div key={i}>
                    <div className="flex justify-between" style={{ marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{phase.name}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {phase.completion}% <span style={{ opacity: 0.5 }}>· {phase.weight}w</span>
                      </span>
                    </div>
                    <div className="phase-bar">
                      <div
                        className="phase-bar-fill"
                        style={{
                          width: `${phase.completion}%`,
                          background: PHASE_COLORS[i % PHASE_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {project.description && (
          <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {project.description}
          </p>
        )}
      </div>
    </div>
  );
}
