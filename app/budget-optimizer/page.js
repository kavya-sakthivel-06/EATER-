'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function BudgetOptimizerPage() {
  const [budget, setBudget] = useState(120);
  const [proteinGoal, setProteinGoal] = useState(25);
  const [vegetarian, setVegetarian] = useState('All');
  const [canteen, setCanteen] = useState('');
  const [category, setCategory] = useState('');

  const [canteens, setCanteens] = useState([]);
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loggingAll, setLoggingAll] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch canteen/category dropdown options
  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch('/api/foods');
        if (res.ok) {
          const json = await res.json();
          setCanteens(json.canteens || []);
          setCategories(json.categories || []);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadMeta();
  }, []);

  const runOptimizer = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/budget-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget: Number(budget),
          proteinGoal: Number(proteinGoal),
          vegetarian: vegetarian === 'All' ? null : vegetarian,
          canteen: canteen || null,
          category: category || null
        })
      });
      if (!res.ok) throw new Error('Optimizer query failed');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      showToast('Error calculating optimized meal plan', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runOptimizer();
  }, []);

  const handleLogPlanItem = async (item) => {
    try {
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_db_id: item.id,
          quantity: 1,
          logged_at: new Date().toISOString(),
          source: 'optimizer'
        })
      });
      if (res.ok) {
        showToast(`Logged "${item.food_name}" to your dashboard!`, 'success');
      } else {
        throw new Error('Failed to log');
      }
    } catch (e) {
      showToast('Could not log item', 'error');
    }
  };

  const handleLogEntirePlan = async () => {
    if (!data?.plan || data.plan.length === 0) return;
    setLoggingAll(true);
    try {
      for (const item of data.plan) {
        await fetch('/api/food-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            food_db_id: item.id,
            quantity: 1,
            logged_at: new Date().toISOString(),
            source: 'optimizer'
          })
        });
      }
      showToast(`Logged all ${data.plan.length} items from this meal plan!`, 'success');
    } catch (e) {
      showToast('Error logging meal plan', 'error');
    } finally {
      setLoggingAll(false);
    }
  };

  const summary = data?.summary || {};
  const plan = data?.plan || [];
  const alternatives = data?.alternatives || [];

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
          <h1 className="page-title">Budget-Aware Nutrition Optimizer</h1>
          <p className="page-subtitle">
            Linear programming and greedy knapsack optimization to maximize protein intake within a strict budget ceiling.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={runOptimizer}
            disabled={loading}
          >
            {loading ? 'Optimizing...' : 'Recompute Plan'}
          </button>
          {plan.length > 0 && (
            <button
              className="btn btn-primary"
              onClick={handleLogEntirePlan}
              disabled={loggingAll}
            >
              {loggingAll ? 'Logging...' : 'Log Entire Meal Plan'}
            </button>
          )}
        </div>
      </div>

      {/* Faculty & Methodological Callout */}
      <div className="editorial-callout">
        <div className="editorial-callout-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <path d="M2 17L12 22L22 17" />
            <path d="M2 12L12 17L22 12" />
          </svg>
          Optimization Formulation
        </div>
        <div className="editorial-callout-text">
          Solves a bounded knapsack optimization problem over verified canteen dishes: maximizes total protein subject to total cost &le; ₹{budget}. Missing nutrition values are strictly flagged and omitted from density computations rather than coerced to zero.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '28px', alignItems: 'start' }}>
        {/* Controls Column */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Optimization Parameters</span>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Budget Ceiling</label>
              <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '14px' }}>₹{budget}</span>
            </div>
            <input
              type="range"
              min="20"
              max="350"
              step="5"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>₹20</span>
              <span>₹150</span>
              <span>₹350</span>
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Target Protein</label>
              <span style={{ fontWeight: 700, color: 'var(--accent-emerald)', fontSize: '14px' }}>{proteinGoal}g</span>
            </div>
            <input
              type="range"
              min="5"
              max="70"
              step="1"
              value={proteinGoal}
              onChange={(e) => setProteinGoal(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>5g</span>
              <span>35g</span>
              <span>70g</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Dietary Preference</label>
            <select
              className="form-select"
              value={vegetarian}
              onChange={(e) => setVegetarian(e.target.value)}
            >
              <option value="All">Any (Veg & Non-Veg)</option>
              <option value="Veg">Vegetarian Only</option>
              <option value="Non-Veg">Non-Vegetarian Only</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Canteen</label>
            <select
              className="form-select"
              value={canteen}
              onChange={(e) => setCanteen(e.target.value)}
            >
              <option value="">All Campus Canteens</option>
              {canteens.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Food Category</label>
            <select
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px' }}
            onClick={runOptimizer}
            disabled={loading}
          >
            {loading ? 'Solving...' : 'Solve Optimal Meal Plan'}
          </button>
        </div>

        {/* Results Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Summary Metrics */}
          <div className="card-grid card-grid-3">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Total Cost</span>
                <span className={`badge ${summary.total_cost <= budget ? 'badge-emerald' : 'badge-rose'}`}>
                  {summary.total_cost <= budget ? 'Within Budget' : 'Exceeded'}
                </span>
              </div>
              <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>
                ₹{summary.total_cost || 0}
              </div>
              <div className="stat-label">
                Budget limit: ₹{budget} (₹{summary.budget_remaining || 0} remaining)
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Protein Achieved</span>
                <span className={`badge ${summary.goal_met ? 'badge-emerald' : 'badge-amber'}`}>
                  {summary.goal_met ? 'Goal Achieved' : 'Partial'}
                </span>
              </div>
              <div className="stat-value" style={{ color: summary.goal_met ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                {summary.protein_achieved || 0}<span className="stat-unit">g</span>
              </div>
              <div className="stat-label">
                Target: {proteinGoal}g ({Math.round(((summary.protein_achieved || 0) / proteinGoal) * 100)}% coverage)
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Calories</span>
                <span className="badge badge-gray">Estimated</span>
              </div>
              <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>
                {summary.total_calories || 0}<span className="stat-unit">kcal</span>
              </div>
              <div className="stat-label">
                Energy yield for selected items
              </div>
            </div>
          </div>

          {/* Recommended Combination Plan */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Recommended Meal Combination</h3>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Selected to deliver maximum verified protein within ₹{budget}
                </div>
              </div>
              <span className="badge badge-blue">{plan.length} Items</span>
            </div>

            {plan.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                No dishes match this exact criteria. Try raising the budget or selecting All Canteens.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {plan.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-primary-tint)',
                        color: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700
                      }}>
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                          {item.food_name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {item.canteen} &bull; {item.category} {item.vegetarian && `&bull; ${item.vegetarian}`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--accent-primary)' }}>
                          ₹{item.price_inr}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                          {item.protein_g != null ? `${item.protein_g}g protein` : 'Protein N/A'}
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleLogPlanItem(item)}
                      >
                        + Log Item
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alternatives & Swaps */}
          {alternatives.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>High-Yield Alternative Swaps</h3>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Dishes providing high protein-to-cost ratio you could swap in
                  </div>
                </div>
                <span className="badge badge-gray">Alternatives</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                {alternatives.map(alt => (
                  <div
                    key={alt.id}
                    style={{
                      padding: '14px',
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {alt.food_name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {alt.canteen} &bull; ₹{alt.price_inr}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-emerald">+{alt.protein_g}g Protein</span>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleLogPlanItem(alt)}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
