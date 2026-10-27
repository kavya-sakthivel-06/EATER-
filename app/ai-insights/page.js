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
import { Line, Bar } from 'react-chartjs-2';

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

export default function AIInsightsPage() {
  const [activeTab, setActiveTab] = useState('prediction'); // 'prediction' | 'anomaly' | 'clusters' | 'recommendations'
  
  // Data States
  const [spendingData, setSpendingData] = useState(null);
  const [anomalyData, setAnomalyData] = useState(null);
  const [clusterData, setClusterData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dismissed Anomaly Dates
  const [dismissedDates, setDismissedDates] = useState(new Set());
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAllAIData = async () => {
    setLoading(true);
    try {
      const [spendRes, anomRes, clustRes] = await Promise.all([
        fetch('/api/ai/spending-prediction'),
        fetch('/api/ai/unusual-spending'),
        fetch('/api/ai/behavior-clusters')
      ]);

      if (spendRes.ok) setSpendingData(await spendRes.json());
      if (anomRes.ok) setAnomalyData(await anomRes.json());
      if (clustRes.ok) setClusterData(await clustRes.json());
    } catch (err) {
      console.error('Failed to load AI insights', err);
      showToast('Error loading AI models', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAIData();
  }, []);

  const handleDismissAnomaly = (date) => {
    setDismissedDates(prev => {
      const next = new Set(prev);
      next.add(date);
      return next;
    });
    showToast(`Flag for ${date} dismissed`, 'success');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <span>Evaluating mathematical models (Linear Regression, Isolation Forest, K-Means)...</span>
      </div>
    );
  }

  // Regression Chart Setup
  const cumulativePoints = spendingData?.cumulative_data || [];
  const trajectoryPoints = spendingData?.projected_trajectory || [];

  const regressionLabels = Array.from({ length: spendingData?.days_in_month || 30 }, (_, i) => `Day ${i + 1}`);

  const actualSpendMap = {};
  cumulativePoints.forEach(p => { actualSpendMap[p.day] = p.cumSpend; });

  const trajectoryMap = {};
  trajectoryPoints.forEach(p => { trajectoryMap[p.day] = p.projected; });

  const regressionChartData = {
    labels: regressionLabels,
    datasets: [
      {
        label: 'Actual Cumulative Spend (₹)',
        data: regressionLabels.map((_, i) => actualSpendMap[i + 1] !== undefined ? actualSpendMap[i + 1] : null),
        borderColor: '#1e3a2b',
        backgroundColor: 'rgba(30, 58, 43, 0.1)',
        borderWidth: 2.5,
        pointRadius: 3,
        tension: 0.1,
      },
      {
        label: 'Linear Regression Trajectory (₹)',
        data: regressionLabels.map((_, i) => trajectoryMap[i + 1] !== undefined ? trajectoryMap[i + 1] : null),
        borderColor: '#c2410c',
        borderDash: [5, 4],
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
      },
      {
        label: 'Monthly Budget Limit (₹)',
        data: regressionLabels.map(() => spendingData?.budget || 5000),
        borderColor: '#be123c',
        borderDash: [2, 2],
        borderWidth: 1.5,
        pointRadius: 0,
      }
    ]
  };

  const regressionChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { color: 'rgba(24, 24, 27, 0.05)' },
        ticks: { color: '#71717a' }
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Cumulative Spend (₹)', color: '#1e3a2b' },
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

  // Silhouette Scores Chart for K-Means
  const kCandidates = clusterData?.k_candidates || [];
  const kChartData = {
    labels: kCandidates.map(c => `K = ${c.k}`),
    datasets: [
      {
        label: 'Silhouette Score (higher = denser separation)',
        data: kCandidates.map(c => c.silhouette),
        backgroundColor: kCandidates.map(c => c.k === clusterData?.selected_k ? '#15803d' : 'rgba(30, 58, 43, 0.3)'),
        borderColor: '#1e3a2b',
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  };

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
          <h1 className="page-title">AI Insights & Predictive Analytics Hub</h1>
          <p className="page-subtitle">
            Demonstrating Eater's four core algorithms connected to real application records: Cosine Similarity, Linear Regression, Isolation Forest, and K-Means.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/budget-optimizer" className="btn btn-secondary">
            Budget Optimizer
          </Link>
          <Link href="/spending-coach" className="btn btn-secondary">
            Spending Coach
          </Link>
        </div>
      </div>

      {/* Faculty Presentation Summary Callout */}
      <div className="editorial-callout">
        <div className="editorial-callout-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
          Academic Defense & Methodology Summary
        </div>
        <p className="editorial-callout-text">
          &ldquo;Eater has four AI components. <strong>Cosine Similarity</strong> ranks food recommendations according to a student's preferences and nutrition/budget goals. <strong>Linear Regression</strong> estimates month-end spending from dated spending history. <strong>Isolation Forest</strong> flags spending days that differ from the student's normal pattern. <strong>K-Means</strong> groups anonymized student records using features such as average spending, protein intake where available, and items logged per day. The dashboard explains each result, and I evaluate the models with suitable metrics or baselines instead of claiming unverified accuracy.&rdquo;
        </p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'prediction' ? 'active' : ''}`}
          onClick={() => setActiveTab('prediction')}
        >
          Spending Forecast (Linear Regression)
        </button>
        <button
          className={`tab ${activeTab === 'anomaly' ? 'active' : ''}`}
          onClick={() => setActiveTab('anomaly')}
        >
          Unusual Spending (Isolation Forest)
        </button>
        <button
          className={`tab ${activeTab === 'clusters' ? 'active' : ''}`}
          onClick={() => setActiveTab('clusters')}
        >
          Student Behavior (K-Means)
        </button>
        <button
          className={`tab ${activeTab === 'recommendations' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommendations')}
        >
          Food Ranking (Cosine Similarity)
        </button>
      </div>

      {/* TAB 1: Linear Regression Spending Prediction */}
      {activeTab === 'prediction' && spendingData && (
        <div>
          {/* Top Metric Cards */}
          <div className="card-grid card-grid-3" style={{ marginBottom: '24px' }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Predicted Month-End Spend</span>
                <span className="badge badge-blue">Regression</span>
              </div>
              <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>
                ₹{spendingData.predicted_month_end}
              </div>
              <div className="stat-label">
                Current spend so far: ₹{spendingData.current_spent} (Day {spendingData.current_day} of {spendingData.days_in_month})
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Budget Comparison</span>
                <span className={`badge ${spendingData.over_budget ? 'badge-rose' : 'badge-emerald'}`}>
                  {spendingData.over_budget ? 'Over Budget' : 'Within Budget'}
                </span>
              </div>
              <div className="stat-value" style={{ color: spendingData.over_budget ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                {spendingData.budget_difference >= 0 ? `+₹${spendingData.budget_difference}` : `-₹${Math.abs(spendingData.budget_difference)}`}
              </div>
              <div className="stat-label">
                Monthly Target Budget: ₹{spendingData.budget} ({spendingData.over_budget ? 'projected deficit' : 'projected surplus'})
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Baseline Comparison</span>
                <span className="badge badge-amber">Daily Avg Benchmark</span>
              </div>
              <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>
                ₹{spendingData.baseline_prediction}
              </div>
              <div className="stat-label">
                Daily Avg: ₹{spendingData.avg_daily_spend}/day &times; {spendingData.days_in_month} days
              </div>
            </div>
          </div>

          {/* Interactive Chart */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Cumulative Spending Trajectory</h3>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Actual cumulative spend (solid dark) vs linear regression fit (terracotta dashed) and monthly budget ceiling (red)
                </div>
              </div>
              {spendingData.regression && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  Spend = {spendingData.regression.slope} &times; Day + {spendingData.regression.intercept} (R² = {spendingData.regression.r2})
                </div>
              )}
            </div>
            <div className="chart-container" style={{ height: '300px' }}>
              <Line data={regressionChartData} options={regressionChartOptions} />
            </div>
          </div>

          {/* Evaluation & Technical Specifications */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Model Evaluation & Methodological Rigor</h3>
              <span className="badge badge-blue">Held-out Split</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Held-Out Evaluation Metrics
                </h4>
                <div style={{ background: 'var(--bg-canvas)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Model MAE (Mean Abs Error):</span>
                    <strong style={{ color: 'var(--accent-primary)' }}>{spendingData.evaluation?.mae != null ? `₹${spendingData.evaluation.mae}` : 'N/A'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Baseline MAE (Daily Avg):</span>
                    <strong style={{ color: 'var(--accent-amber)' }}>{spendingData.evaluation?.baseline_mae != null ? `₹${spendingData.evaluation.baseline_mae}` : 'N/A'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Test R² Score:</span>
                    <strong style={{ color: (spendingData.evaluation?.r2 ?? 0) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                      {spendingData.evaluation?.r2 != null ? spendingData.evaluation.r2 : 'N/A'}
                    </strong>
                  </div>
                </div>

                {spendingData.evaluation?.note && (
                  <div style={{ marginTop: '10px', padding: '10px', background: 'var(--accent-rose-tint)', border: '1px solid #fecdd3', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--accent-rose)' }}>
                    Notice: {spendingData.evaluation.note}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Model Parameters & Constraints
                </h4>
                <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '18px', lineHeight: 1.7 }}>
                  <li><strong>Data Period:</strong> {spendingData.data_period}</li>
                  <li><strong>Chronological Split:</strong> 80% train / 20% test. Avoids leakage of future temporal information.</li>
                  <li><strong>Baseline Rule:</strong> Standard rolling average extrapolated across remaining month days.</li>
                  {spendingData.limitations?.map((lim, i) => (
                    <li key={i} style={{ color: 'var(--text-muted)' }}>{lim}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Isolation Forest Unusual Spending */}
      {activeTab === 'anomaly' && anomalyData && (
        <div>
          {/* Header Stats */}
          <div className="card-grid card-grid-4" style={{ marginBottom: '24px' }}>
            <div className="card">
              <span className="card-title">Days Analyzed</span>
              <div className="stat-value">{anomalyData.total_days_analyzed}</div>
              <div className="stat-label">Total recorded dates in history</div>
            </div>

            <div className="card">
              <span className="card-title">Unusual Spending Days</span>
              <div className="stat-value" style={{ color: anomalyData.unusual_count > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                {anomalyData.unusual_count}
              </div>
              <div className="stat-label">Days flagged above threshold</div>
            </div>

            <div className="card">
              <span className="card-title">Anomaly Threshold</span>
              <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>{anomalyData.threshold}</div>
              <div className="stat-label">Isolation score cutoff</div>
            </div>

            <div className="card">
              <span className="card-title">Contamination Rate</span>
              <div className="stat-value">{anomalyData.contamination_rate * 100}%</div>
              <div className="stat-label">Configurable expected outlier rate</div>
            </div>
          </div>

          <div className="editorial-callout" style={{ borderLeftColor: 'var(--accent-amber)' }}>
            <div className="editorial-callout-text">
              <strong>Unsupervised Anomaly Detection:</strong> {anomalyData.validation_note} Flagged dates represent spending or item counts that deviate from your statistical norm. You can inspect and dismiss any flag below.
            </div>
          </div>

          {/* Flagged Days Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Flagged Unusual Spending Days ({anomalyData.flagged_days.filter(d => !dismissedDates.has(d.date)).length})
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Features used: {anomalyData.features_used?.join(', ')}
                </div>
              </div>
            </div>

            {anomalyData.flagged_days.filter(d => !dismissedDates.has(d.date)).length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No active unusual spending flags</div>
                <div className="empty-state-text">All recorded spending days are consistent with your usual campus eating pattern.</div>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Daily Spend</th>
                      <th>Items Logged</th>
                      <th>Avg Item Price</th>
                      <th>Score</th>
                      <th>Observed Contributing Factor</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalyData.flagged_days
                      .filter(d => !dismissedDates.has(d.date))
                      .map((d, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{d.date}</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>₹{d.daily_spend}</td>
                          <td>{d.item_count} items</td>
                          <td>₹{d.avg_item_price}</td>
                          <td>
                            <span className="badge badge-amber">{d.anomaly_score}</span>
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {d.reason}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleDismissAnomaly(d.date)}
                              className="btn btn-sm btn-secondary"
                              title="Dismiss flag"
                            >
                              Dismiss
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: K-Means Eating-Behaviour Groups */}
      {activeTab === 'clusters' && clusterData && (
        <div>
          {clusterData.is_synthetic && (
            <div className="editorial-callout" style={{ borderLeftColor: 'var(--accent-primary)' }}>
              <div className="editorial-callout-text">
                <strong>Faculty Demonstration Notice:</strong> Multi-student behavior groups are formed from {clusterData.total_users} anonymized demo student records with 45+ days of food history. Individual privacy is fully protected; no personal meal logs are exposed.
              </div>
            </div>
          )}

          {/* Model Metrics */}
          <div className="card-grid card-grid-3" style={{ marginBottom: '24px' }}>
            <div className="card">
              <span className="card-title">Optimal Cluster Count</span>
              <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>K = {clusterData.selected_k}</div>
              <div className="stat-label">Selected via maximum silhouette score</div>
            </div>

            <div className="card">
              <span className="card-title">Silhouette Score</span>
              <div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>{clusterData.silhouette_score}</div>
              <div className="stat-label">Metric range: -1 (poor) to +1 (dense clustering)</div>
            </div>

            <div className="card">
              <span className="card-title">Standardized Features</span>
              <div className="stat-value" style={{ fontSize: '24px' }}>3 Dimensions</div>
              <div className="stat-label">Daily Spend (₹), Daily Protein (g), Items Logged</div>
            </div>
          </div>

          {/* Discovered Cluster Groups */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header">
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Discovered Student Eating-Behaviour Groups</h3>
              <span className="badge badge-emerald">Centroid-Derived</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {clusterData.clusters?.map((cluster) => (
                <div
                  key={cluster.cluster_id}
                  style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '20px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <span className="badge badge-blue" style={{ marginBottom: '6px' }}>
                        Cluster #{cluster.cluster_id + 1}
                      </span>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {cluster.name}
                      </h4>
                    </div>
                    <span className="badge badge-gray">
                      {cluster.member_count} student{cluster.member_count > 1 ? 's' : ''}
                    </span>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    {cluster.description}
                  </p>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px' }}>
                      Cluster Centroid Center:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                      <div style={{ background: '#ffffff', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>AVG SPEND</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-primary)' }}>₹{cluster.centroid.avg_daily_spend}</div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>AVG PROTEIN</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-emerald)' }}>{cluster.centroid.avg_daily_protein}g</div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>AVG ITEMS</div>
                        <div style={{ fontSize: '15px', fontWeight: 700 }}>{cluster.centroid.avg_daily_items}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Candidate K Evaluation Chart */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Candidate K Evaluation & Silhouette Scores</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Evaluated candidate K values rather than assuming fixed K=3
                </div>
              </div>
            </div>
            <div className="chart-container" style={{ height: '240px' }}>
              <Bar
                data={kChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { ticks: { color: '#71717a' }, grid: { color: 'rgba(24, 24, 27, 0.05)' } },
                    y: { ticks: { color: '#71717a' }, grid: { color: 'rgba(24, 24, 27, 0.05)' }, min: -0.2, max: 1.0 }
                  },
                  plugins: { legend: { labels: { color: '#18181b', font: { family: 'Plus Jakarta Sans', size: 12, weight: 600 } } } }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Cosine Similarity Summary */}
      {activeTab === 'recommendations' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Cosine Similarity Recommendation System</h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AI Feature 1 Details & Vector Formulations</div>
            </div>
            <Link href="/recommendations" className="btn btn-primary">
              Open Full Recommendations Page &rarr;
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '16px' }}>
            <div style={{ background: 'var(--bg-canvas)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '8px' }}>Input Features</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Constructs 3D normalized candidate food vectors: Price (inverted to favor budget), Calories (normalized against menu range), and Protein (normalized).
              </p>
            </div>

            <div style={{ background: 'var(--bg-canvas)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '8px' }}>Mathematical Form</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Dot product divided by vector norms: <code>sim(u, v) = (u &bull; v) / (||u|| ||v||)</code>. Allows scale-invariant comparison between preference and item characteristics.
              </p>
            </div>

            <div style={{ background: 'var(--bg-canvas)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--accent-amber)', marginBottom: '8px' }}>Missing Data Handling</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Items without nutritional facts are assigned a neutral 0.5 coordinate instead of 0 to prevent artificial penalization.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
