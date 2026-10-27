'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SpendingCoachPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeSimulationIndex, setActiveSimulationIndex] = useState(0);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCoachData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/spending-behaviour');
      if (!res.ok) throw new Error('Failed to fetch spending coach analysis');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      showToast('Error loading spending coach insights', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoachData();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <span>Analyzing spending patterns & calculating behavioural trajectories...</span>
      </div>
    );
  }

  const {
    user_name = 'Student',
    budget = 5000,
    spent = 0,
    budget_remaining = 5000,
    budget_used_pct = 0,
    daily_burn_rate = 0,
    safe_daily_rate = 0,
    projected_month_end = 0,
    projected_deficit = 0,
    days_until_depletion = 30,
    days_logged = 1,
    days_remaining = 30,
    top_categories = [],
    day_of_week_analysis = [],
    weekend_skew_pct = 0,
    simulations = [],
    suggestions = []
  } = data || {};

  const isOverBudgetProjected = projected_deficit > 0;

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
          <h1 className="page-title">AI Spending Behaviour Coach</h1>
          <p className="page-subtitle">
            Learns from logged spending to diagnose why food money depletes, estimate month-end burn, and simulate behavioral savings.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={fetchCoachData}>
            Refresh Analytics
          </button>
          <Link href="/log-food" className="btn btn-primary">
            + Log New Meal
          </Link>
        </div>
      </div>

      {/* Core Diagnostic Banner */}
      <div style={{
        background: isOverBudgetProjected ? 'var(--accent-terracotta-tint)' : 'var(--accent-emerald-tint)',
        border: `1px solid ${isOverBudgetProjected ? '#fed7aa' : '#bbf7d0'}`,
        borderLeft: `4px solid ${isOverBudgetProjected ? 'var(--accent-terracotta)' : 'var(--accent-emerald)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        marginBottom: '28px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span style={{ fontSize: '18px' }}>{isOverBudgetProjected ? '⚠️' : '✅'}</span>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: isOverBudgetProjected ? 'var(--accent-terracotta)' : 'var(--accent-emerald)' }}>
            {isOverBudgetProjected
              ? `Spending Velocity Warning: Budget exhausts in ~${days_until_depletion} days`
              : 'Healthy Trajectory: Operating within monthly financial allowance'}
          </h2>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
          {isOverBudgetProjected
            ? `At your current burn rate of ₹${daily_burn_rate}/day, your month-end spend is projected at ₹${projected_month_end} (+₹${projected_deficit} over your ₹${budget} budget). Adjust your daily pace to ₹${safe_daily_rate}/day to preserve solvency.`
            : `Your daily pace of ₹${daily_burn_rate}/day maintains a projected surplus of ₹${Math.abs(projected_deficit)} at month-end. You have ₹${budget_remaining} remaining for the next ${days_remaining} days.`}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="card-grid card-grid-4" style={{ marginBottom: '28px' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Spent So Far</span>
            <span className="badge badge-gray">{budget_used_pct}% used</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>
            ₹{spent}
          </div>
          <div className="stat-label">
            Target budget: ₹{budget}
          </div>
          <div className="stat-progress">
            <div
              className="stat-progress-bar"
              style={{
                width: `${budget_used_pct}%`,
                background: budget_used_pct > 80 ? 'var(--accent-terracotta)' : 'var(--accent-primary)'
              }}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Current Burn Rate</span>
            <span className="badge badge-amber">Daily Pace</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>
            ₹{daily_burn_rate}<span className="stat-unit">/day</span>
          </div>
          <div className="stat-label">
            Safe pace: ₹{safe_daily_rate}/day to stay on budget
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Projected Month-End</span>
            <span className={`badge ${isOverBudgetProjected ? 'badge-rose' : 'badge-emerald'}`}>
              {isOverBudgetProjected ? 'Deficit' : 'Surplus'}
            </span>
          </div>
          <div className="stat-value" style={{ color: isOverBudgetProjected ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
            ₹{projected_month_end}
          </div>
          <div className="stat-label">
            {isOverBudgetProjected ? `+₹${projected_deficit} above budget` : `-₹${Math.abs(projected_deficit)} under budget`}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Weekend Skew</span>
            <span className="badge badge-blue">Temporal</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>
            {weekend_skew_pct}%
          </div>
          <div className="stat-label">
            Percentage of total budget spent on weekends
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '28px', marginBottom: '28px' }}>
        {/* Day-of-Week Spending Heatmap / Breakdown */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Day of Week Outflow Breakdown</h3>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Identifies recurring days associated with elevated spending
              </div>
            </div>
            <span className="badge badge-gray">Historical Logs</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            {day_of_week_analysis.map((d) => {
              const maxSpend = Math.max(...day_of_week_analysis.map(x => x.total), 1);
              const pct = Math.round((d.total / maxSpend) * 100);
              const isWeekend = d.day === 'Saturday' || d.day === 'Sunday';

              return (
                <div key={d.day}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: isWeekend ? 'var(--accent-terracotta)' : 'var(--text-primary)' }}>
                      {d.day} {isWeekend && '(Weekend)'}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      ₹{d.total} <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 400 }}>(avg ₹{d.average}/visit)</span>
                    </span>
                  </div>
                  <div style={{ height: '7px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: isWeekend ? 'var(--accent-terracotta)' : 'var(--accent-primary)',
                        borderRadius: 'var(--radius-full)',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Expense Categories */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Expense Sinks by Category</h3>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Distribution of spending across menu types
              </div>
            </div>
            <span className="badge badge-gray">{top_categories.length} Categories</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {top_categories.map((cat, idx) => (
              <div
                key={cat.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: 'var(--radius-sm)',
                    background: idx === 0 ? 'var(--accent-terracotta-tint)' : 'var(--bg-subtle)',
                    color: idx === 0 ? 'var(--accent-terracotta)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {idx + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                      {cat.name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      {cat.percentage}% of total logged spend
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                  ₹{cat.amount}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Behavioral What-If Savings Simulations */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="card-header">
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Behavioral "What-If" Savings Simulations</h3>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Select a realistic habit adjustment to simulate immediate financial recovery
            </div>
          </div>
          <span className="badge badge-emerald">Interactive Simulator</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '8px' }}>
          {simulations.map((sim, idx) => {
            const isSelected = activeSimulationIndex === idx;
            return (
              <div
                key={sim.title}
                onClick={() => setActiveSimulationIndex(idx)}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                  background: isSelected ? 'var(--accent-primary-tint)' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                    {sim.title}
                  </span>
                  <span className="badge badge-emerald">
                    +₹{sim.monthly_savings}/mo
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>
                  {sim.scenario}
                </p>
                <div style={{ fontSize: '11.5px', color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                  Impact: {sim.impact}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actionable Coach Guidance Notes */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Actionable Coach Recommendations</h3>
          <span className="badge badge-blue">Personalized</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {suggestions.map((sug, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '12px',
                padding: '14px 18px',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13.5px',
                lineHeight: 1.6,
                color: 'var(--text-primary)'
              }}
            >
              <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>•</span>
              <div>{sug}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
