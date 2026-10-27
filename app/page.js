'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('today');
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`/api/dashboard?filter=${dateFilter}`);
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      showToast('Error loading dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [dateFilter]);

  const handleDeleteLog = async (id) => {
    if (!confirm('Are you sure you want to remove this log?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/food-logs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Food log deleted successfully', 'success');
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete item', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <span>Loading nutrition & spending dashboard...</span>
      </div>
    );
  }

  const { today, month, targets, weeklyData = [], recentLogs = [], user } = data || {};

  // Weekly Nutrition Chart (Calories & Protein)
  const nutritionLabels = weeklyData.map(d => {
    const dt = new Date(d.date);
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
  });

  const nutritionChartData = {
    labels: nutritionLabels,
    datasets: [
      {
        type: 'bar',
        label: 'Calories (kcal)',
        data: weeklyData.map(d => d.daily_calories || 0),
        backgroundColor: 'rgba(30, 58, 43, 0.75)',
        borderColor: '#1e3a2b',
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: 'y',
      },
      {
        type: 'line',
        label: 'Protein (g)',
        data: weeklyData.map(d => d.daily_protein || 0),
        borderColor: '#15803d',
        backgroundColor: 'rgba(21, 128, 61, 0.15)',
        borderWidth: 2,
        tension: 0.25,
        pointBackgroundColor: '#15803d',
        pointRadius: 4,
        yAxisID: 'y1',
      }
    ]
  };

  const nutritionChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        grid: { color: 'rgba(24, 24, 27, 0.05)' },
        ticks: { color: '#71717a' }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true, text: 'Calories (kcal)', color: '#1e3a2b' },
        grid: { color: 'rgba(24, 24, 27, 0.05)' },
        ticks: { color: '#71717a' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: { display: true, text: 'Protein (g)', color: '#15803d' },
        grid: { drawOnChartArea: false },
        ticks: { color: '#71717a' }
      }
    },
    plugins: {
      legend: {
        labels: { color: '#18181b', font: { family: 'Plus Jakarta Sans', size: 12, weight: 600 } }
      }
    }
  };

  // Spending Chart
  const spendingChartData = {
    labels: nutritionLabels,
    datasets: [
      {
        fill: true,
        label: 'Daily Spending (₹)',
        data: weeklyData.map(d => d.daily_spending || 0),
        borderColor: '#c2410c',
        backgroundColor: 'rgba(194, 65, 12, 0.08)',
        borderWidth: 2,
        tension: 0.25,
        pointBackgroundColor: '#c2410c',
        pointRadius: 4,
      }
    ]
  };

  const spendingChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { color: 'rgba(24, 24, 27, 0.05)' },
        ticks: { color: '#71717a' }
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Spending (₹)', color: '#c2410c' },
        grid: { color: 'rgba(24, 24, 27, 0.05)' },
        ticks: { color: '#71717a' }
      }
    },
    plugins: {
      legend: {
        labels: { color: '#18181b', font: { family: 'Plus Jakarta Sans', size: 12, weight: 600 } }
      }
    }
  };

  const calPercent = Math.min(Math.round(((today?.calories || 0) / (targets?.calories?.target || 2000)) * 100), 100);
  const proPercent = Math.min(Math.round(((today?.protein || 0) / (targets?.protein?.target || 50)) * 100), 100);
  const budgetPercent = Math.min(Math.round(((month?.spending || 0) / (month?.budget || 5000)) * 100), 100);

  return (
    <div>
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {user?.name || 'Kavya'}</h1>
          <p className="page-subtitle">
            Real-time campus dining records, verified protein intake, and transparent monthly budget monitoring.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link href="/log-food" className="btn btn-primary">
            + Log Food
          </Link>
          <Link href="/budget-optimizer" className="btn btn-secondary">
            Budget Optimizer
          </Link>
          <Link href="/spending-coach" className="btn btn-secondary">
            Spending Coach
          </Link>
        </div>
      </div>

      {/* Incomplete Nutrition Alert Banner */}
      {today?.nutrition_incomplete && (
        <div className="editorial-callout" style={{ borderLeftColor: 'var(--accent-amber)' }}>
          <div className="editorial-callout-title" style={{ color: 'var(--accent-amber)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Incomplete Nutrition Notice
          </div>
          <div className="editorial-callout-text">
            {today?.items_logged - today?.items_with_nutrition} of {today?.items_logged} meals logged today lack lab-verified nutrition. Missing values are excluded from summary totals rather than incorrectly presented as zero.
          </div>
        </div>
      )}

      {/* Top Stat Cards (Priority 1) */}
      <div className="card-grid card-grid-4" style={{ marginBottom: '28px' }}>
        {/* Calories Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Calories Today</span>
            <span className="badge badge-blue">Goal {targets?.calories?.target} kcal</span>
          </div>
          <div className="stat-value">
            {Math.round(today?.calories || 0)} <span className="stat-unit">kcal</span>
          </div>
          <div className="stat-label">
            Remaining: <strong style={{ color: targets?.calories?.remaining >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>{Math.round(targets?.calories?.remaining || 0)} kcal</strong>
          </div>
          <div className="stat-progress">
            <div 
              className="stat-progress-bar" 
              style={{ 
                width: `${calPercent}%`, 
                background: calPercent > 100 ? 'var(--accent-rose)' : 'var(--accent-primary)' 
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '8px' }}>
            <span>{calPercent}% of target</span>
            <span>Target: {targets?.calories?.target} kcal</span>
          </div>
        </div>

        {/* Protein Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Protein Today</span>
            <span className="badge badge-emerald">Goal {targets?.protein?.target}g</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>
            {Math.round(today?.protein || 0)} <span className="stat-unit">g</span>
          </div>
          <div className="stat-label">
            Remaining: <strong style={{ color: targets?.protein?.remaining >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>{Math.round(targets?.protein?.remaining || 0)} g</strong>
          </div>
          <div className="stat-progress">
            <div 
              className="stat-progress-bar" 
              style={{ 
                width: `${proPercent}%`, 
                background: proPercent >= 100 ? 'var(--accent-emerald)' : '#16a34a' 
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '8px' }}>
            <span>{proPercent}% of target</span>
            <span>Target: {targets?.protein?.target}g</span>
          </div>
        </div>

        {/* Spending Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Campus Spending</span>
            <span className="badge badge-amber">Monthly</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-terracotta)' }}>
            ₹{Math.round(today?.spending || 0)} <span className="stat-unit">today</span>
          </div>
          <div className="stat-label">
            Monthly spend: ₹{Math.round(month?.spending || 0)} / ₹{month?.budget}
          </div>
          <div className="stat-progress">
            <div 
              className="stat-progress-bar" 
              style={{ 
                width: `${budgetPercent}%`, 
                background: budgetPercent > 90 ? 'var(--accent-rose)' : 'var(--accent-terracotta)' 
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '8px' }}>
            <span>{budgetPercent}% of monthly cap</span>
            <span>₹{month?.remaining} left</span>
          </div>
        </div>

        {/* Items Logged Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Meals Logged</span>
            <span className={`badge ${today?.items_logged > 0 ? 'badge-emerald' : 'badge-gray'}`}>
              {today?.items_logged > 0 ? 'Active' : 'Idle'}
            </span>
          </div>
          <div className="stat-value">
            {today?.items_logged || 0} <span className="stat-unit">items today</span>
          </div>
          <div className="stat-label">
            {today?.items_with_nutrition || 0} items with nutrition verified
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link href="/log-food" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
              + Add Log Entry
            </Link>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Weekly Nutrition Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>Nutrition Intake Trends</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Daily calories (bar) & protein (line) for past 7 days</div>
            </div>
            <span className="badge badge-blue">Past 7 Days</span>
          </div>
          <div className="chart-container" style={{ height: '260px' }}>
            {weeklyData.length > 0 ? (
              <Bar data={nutritionChartData} options={nutritionChartOptions} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-title">No weekly records yet</div>
                <div className="empty-state-text">Start logging meals to populate weekly nutrition intake curves.</div>
              </div>
            )}
          </div>
        </div>

        {/* Weekly Spending Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>Daily Spending Trajectory</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Amount spent across campus canteens (₹)</div>
            </div>
            <span className="badge badge-amber">Outflow</span>
          </div>
          <div className="chart-container" style={{ height: '260px' }}>
            {weeklyData.length > 0 ? (
              <Line data={spendingChartData} options={spendingChartOptions} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-title">No spending data yet</div>
                <div className="empty-state-text">Log canteen purchases to view daily spending trends.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Food Logs Table (Priority 1) */}
      <div className="card">
        <div className="card-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>Recent Campus Dining Logs</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Live ledger entries with nutrition snapshots and canteen locations</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/log-food" className="btn btn-sm btn-primary">
              + New Entry
            </Link>
          </div>
        </div>

        {recentLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No food logged yet</div>
            <div className="empty-state-text">Log your first canteen meal to initiate real-time analytics.</div>
            <Link href="/log-food" className="btn btn-primary">
              Log Your First Food
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Food Item</th>
                  <th>Canteen</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Calories</th>
                  <th>Protein</th>
                  <th>Timestamp</th>
                  <th>Nutrition Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => {
                  const logDate = new Date(log.logged_at);
                  const formattedTime = logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const formattedDate = logDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

                  return (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600 }}>
                        {log.food_name_snapshot}
                        {log.source === 'camera_confirmed' && (
                          <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>[Cam]</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-gray">{log.canteen_snapshot}</span>
                      </td>
                      <td>{log.quantity}x</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>₹{log.price_snapshot}</td>
                      <td>
                        {log.calories_snapshot != null ? (
                          <span style={{ fontWeight: 500 }}>
                            {Math.round(log.calories_snapshot)} kcal
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Not recorded</span>
                        )}
                      </td>
                      <td>
                        {log.protein_snapshot != null ? (
                          <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                            {Math.round(log.protein_snapshot)} g
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Not recorded</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                        {formattedDate}, {formattedTime}
                      </td>
                      <td>
                        <span className={`badge ${log.calories_snapshot != null ? 'badge-emerald' : 'badge-amber'}`}>
                          {log.calories_snapshot != null ? 'Complete' : 'Incomplete'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          disabled={deletingId === log.id}
                          className="btn btn-sm btn-secondary"
                          style={{ color: 'var(--accent-rose)' }}
                          title="Delete entry"
                        >
                          {deletingId === log.id ? '...' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
