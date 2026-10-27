'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function EatingPatternsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPatterns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/eating-patterns');
      if (!res.ok) throw new Error('Failed to load eating patterns');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      showToast('Error loading eating patterns', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatterns();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <span>Clustering student dining habits & deriving behavioural archetypes...</span>
      </div>
    );
  }

  const {
    archetype = 'Routine High-Protein Diner',
    tagline = 'Intentional, nutrient-dense nutrition with structured meal times.',
    traits = [],
    wellness_advice = '',
    all_archetypes = [],
    metrics = {},
    transitions = []
  } = data || {};

  return (
    <div>
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Eating-Pattern Discovery</h1>
          <p className="page-subtitle">
            Unsupervised behavioural clustering uncovering student campus dining archetypes and semester habit evolutions.
          </p>
        </div>
        <div>
          <button className="btn btn-secondary" onClick={fetchPatterns}>
            Re-Cluster Patterns
          </button>
        </div>
      </div>

      {/* Primary Archetype Showcase Card */}
      <div
        style={{
          background: '#ffffff',
          border: '1.5px solid var(--accent-primary)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px 32px',
          marginBottom: '28px',
          boxShadow: 'var(--shadow-md)',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span className="badge badge-emerald" style={{ marginBottom: '8px' }}>
              Primary Detected Archetype
            </span>
            <h2 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '-0.02em', marginTop: '4px' }}>
              {archetype}
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '640px' }}>
              {tagline}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <span className="badge badge-blue">
              {metrics.total_logs_analyzed || 0} meals analyzed
            </span>
            <span className="badge badge-gray">
              {metrics.total_recorded_days || 0} active days
            </span>
          </div>
        </div>

        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Observed Behavioural Traits
            </div>
            <ul style={{ paddingLeft: '18px', fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.7 }}>
              {traits.map((trait, i) => (
                <li key={i}>{trait}</li>
              ))}
            </ul>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Tailored Non-Judgmental Wellness Guidance
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {wellness_advice}
            </p>
          </div>
        </div>
      </div>

      {/* Quantitative Behavioral Feature Metrics */}
      <div className="card-grid card-grid-4" style={{ marginBottom: '28px' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Average Item Spend</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>
            ₹{metrics.avg_spend_per_item || 0}
          </div>
          <div className="stat-label">
            Mean cost per logged canteen food item
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Average Daily Spend</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>
            ₹{metrics.avg_daily_spend || 0}
          </div>
          <div className="stat-label">
            Daily average across active tracked days
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Average Daily Protein</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>
            {metrics.avg_daily_protein || 0}<span className="stat-unit">g</span>
          </div>
          <div className="stat-label">
            Aggregated verified protein intake
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Logging Frequency</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>
            {metrics.avg_items_per_day || 0}<span className="stat-unit">/day</span>
          </div>
          <div className="stat-label">
            Average number of dishes logged per day
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '28px' }}>
        {/* All Campus Archetypes Comparison */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Campus Dining Archetype Spectrum</h3>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Affinity score across all 4 identified campus patterns
              </div>
            </div>
            <span className="badge badge-gray">K-Means Clusters</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            {all_archetypes.map((arch) => {
              const isCurrent = arch.name === archetype;
              return (
                <div
                  key={arch.name}
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${isCurrent ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                    background: isCurrent ? 'var(--accent-primary-tint)' : '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {arch.name}
                    </span>
                    {isCurrent && <span className="badge badge-emerald">Active Match</span>}
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '8px' }}>
                    {arch.tagline}
                  </p>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Wellness tip: {arch.advice}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Temporal Evolution / Transitions */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Semester Habit Evolution</h3>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Tracking behavioural pattern transitions over time
              </div>
            </div>
            <span className="badge badge-blue">Timeline</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '16px' }}>
            {transitions.map((t, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-full)',
                  background: idx === transitions.length - 1 ? 'var(--accent-primary)' : 'var(--bg-subtle)',
                  color: idx === transitions.length - 1 ? '#ffffff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {idx + 1}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>{t.week}</span>
                    <span className="badge badge-gray">{t.confidence} fit</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent-primary)', marginTop: '2px' }}>
                    {t.archetype}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                    {t.note}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
