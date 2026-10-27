'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    name: '',
    email: '',
    daily_calorie_target: 2000,
    daily_protein_target: 50,
    monthly_budget: 5000,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    } catch (err) {
      console.error(err);
      showToast('Error loading settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settings.name,
          daily_calorie_target: Number(settings.daily_calorie_target),
          daily_protein_target: Number(settings.daily_protein_target),
          monthly_budget: Number(settings.monthly_budget),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update settings');
      }

      showToast('Targets and budget saved successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedReset = async () => {
    if (!confirm('Re-seed database with demonstration dataset (45 days history, 200 menu items)?')) return;
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to seed database');
      showToast('Database reset and seeded with 45 days demo history!', 'success');
      await fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <span>Loading personal targets...</span>
      </div>
    );
  }

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
          <h1 className="page-title">Personal Targets & Nutrition Goals</h1>
          <p className="page-subtitle">
            Configure your daily nutritional targets and campus dining budget. These parameters dynamically inform dashboard gauges and AI optimization modules.
          </p>
        </div>
        <div>
          <Link href="/" className="btn btn-secondary">
            ← View Dashboard
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '28px' }}>
        
        {/* Settings Form */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Profile & Goal Parameters</h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Updates propagate immediately to all active models</div>
            </div>
          </div>

          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Student Name</label>
              <input
                type="text"
                className="form-input"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Daily Calorie Target (kcal)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  min="500"
                  max="10000"
                  step="50"
                  className="form-input"
                  value={settings.daily_calorie_target}
                  onChange={(e) => setSettings({ ...settings, daily_calorie_target: e.target.value })}
                  required
                />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>kcal</span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Standard active adult: 1,800 – 2,500 kcal/day
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Daily Protein Target (g)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  min="10"
                  max="500"
                  step="5"
                  className="form-input"
                  value={settings.daily_protein_target}
                  onChange={(e) => setSettings({ ...settings, daily_protein_target: e.target.value })}
                  required
                />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>grams</span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Recommended: 0.8g – 1.2g per kg body weight (~50–80g for students)
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Monthly Campus Food Budget (₹)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  min="500"
                  max="50000"
                  step="100"
                  className="form-input"
                  value={settings.monthly_budget}
                  onChange={(e) => setSettings({ ...settings, monthly_budget: e.target.value })}
                  required
                />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>INR</span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Used by Linear Regression and Spending Coach to forecast month-end balances
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Target Goals'}
              </button>
            </div>
          </form>
        </div>

        {/* Target Breakdown & Student Nutrition Tips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card">
            <div className="card-header">
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Suggested Meal Allocations</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
              <div style={{ background: 'var(--bg-canvas)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Breakfast (~25%)</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {Math.round(settings.daily_calorie_target * 0.25)} kcal
                </div>
                <div style={{ fontSize: '12px', color: 'var(--accent-emerald)', marginTop: '2px', fontWeight: 600 }}>
                  {Math.round(settings.daily_protein_target * 0.25)}g protein
                </div>
              </div>

              <div style={{ background: 'var(--bg-canvas)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Lunch (~40%)</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {Math.round(settings.daily_calorie_target * 0.40)} kcal
                </div>
                <div style={{ fontSize: '12px', color: 'var(--accent-emerald)', marginTop: '2px', fontWeight: 600 }}>
                  {Math.round(settings.daily_protein_target * 0.40)}g protein
                </div>
              </div>

              <div style={{ background: 'var(--bg-canvas)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Dinner (~35%)</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {Math.round(settings.daily_calorie_target * 0.35)} kcal
                </div>
                <div style={{ fontSize: '12px', color: 'var(--accent-emerald)', marginTop: '2px', fontWeight: 600 }}>
                  {Math.round(settings.daily_protein_target * 0.35)}g protein
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
              <strong>Daily Target Outflow:</strong> With a ₹{settings.monthly_budget} budget, maintain an average ceiling of ₹{Math.round(settings.monthly_budget / 30)}/day across all campus meals.
            </div>
          </div>

          {/* Demo Data Management for Evaluation & Grading */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Demonstration Data Management</h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Repeatable database reset and population</div>
              </div>
              <span className="badge badge-gray">Testing</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
              The seed script deduplicates and imports 200 menu items from the Excel sheet, configures 3 student accounts, and seeds 45 days of realistic dining history to test all AI models.
            </p>
            <button
              onClick={handleSeedReset}
              className="btn btn-secondary"
              style={{ width: '100%' }}
              disabled={seeding}
            >
              {seeding ? 'Seeding Database...' : 'Reset & Re-Seed Demo Dataset (45 Days)'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
