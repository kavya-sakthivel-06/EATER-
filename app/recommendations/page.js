'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function RecommendationsPage() {
  const [data, setData] = useState(null);
  const [adaptiveData, setAdaptiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('adaptive'); // 'adaptive' | 'cosine'
  const [toast, setToast] = useState(null);

  // Filter controls for Cosine Similarity
  const [maxPrice, setMaxPrice] = useState(150);
  const [proteinPriority, setProteinPriority] = useState(0.7);
  const [caloriePriority, setCaloriePriority] = useState(0.5);
  const [preferLowCalorie, setPreferLowCalorie] = useState(false);
  const [canteen, setCanteen] = useState('');
  const [category, setCategory] = useState('');

  // Dropdown options
  const [canteens, setCanteens] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loggingId, setLoggingId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (maxPrice) params.append('maxPrice', maxPrice);
      params.append('proteinPriority', proteinPriority);
      params.append('caloriePriority', caloriePriority);
      params.append('preferLowCalorie', preferLowCalorie);
      if (canteen) params.append('canteen', canteen);
      if (category) params.append('category', category);
      params.append('limit', '25');

      const [resCosine, resAdaptive] = await Promise.all([
        fetch(`/api/recommendations?${params.toString()}`),
        fetch('/api/ai/adaptive-recommendations')
      ]);

      if (resCosine.ok) setData(await resCosine.json());
      if (resAdaptive.ok) setAdaptiveData(await resAdaptive.json());
    } catch (err) {
      console.error(err);
      showToast('Error loading recommendations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch('/api/foods');
        if (res.ok) {
          const json = await res.json();
          setCanteens(json.canteens || []);
          setCategories(json.categories || []);
        }
      } catch (e) {}
    }
    loadMeta();
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [maxPrice, proteinPriority, caloriePriority, preferLowCalorie, canteen, category]);

  const handleQuickLog = async (food) => {
    setLoggingId(food.id);
    try {
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_db_id: food.id,
          quantity: 1,
          logged_at: new Date().toISOString(),
          source: 'manual',
        }),
      });
      if (!res.ok) throw new Error('Failed to log');
      showToast(`Logged 1x ${food.food_name}! Check your dashboard.`, 'success');
      // Refresh adaptive context
      const resAdaptive = await fetch('/api/ai/adaptive-recommendations');
      if (resAdaptive.ok) setAdaptiveData(await resAdaptive.json());
    } catch (e) {
      showToast('Could not log food', 'error');
    } finally {
      setLoggingId(null);
    }
  };

  const recommendations = data?.recommendations || [];
  const inputs = data?.inputs || {};
  const adaptiveContext = adaptiveData?.context || {};
  const adaptiveRecs = adaptiveData?.recommendations || [];

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
          <h1 className="page-title">Personalized & Adaptive Food Recommendations</h1>
          <p className="page-subtitle">
            Dynamically tailors meal recommendations according to current time of day, remaining daily protein allowance, and cosine vector alignment.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/budget-optimizer" className="btn btn-secondary">
            Budget Optimizer
          </Link>
          <Link href="/log-food" className="btn btn-primary">
            + Log Food
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'adaptive' ? 'active' : ''}`}
          onClick={() => setActiveTab('adaptive')}
        >
          Adaptive Time-of-Day Engine ({adaptiveData?.time_slot || 'Now'})
        </button>
        <button
          className={`tab ${activeTab === 'cosine' ? 'active' : ''}`}
          onClick={() => setActiveTab('cosine')}
        >
          Cosine Similarity Vector Ranker
        </button>
      </div>

      {/* ADAPTIVE RECOMMENDATIONS TAB */}
      {activeTab === 'adaptive' && (
        <div>
          {/* Real-time Allowance Context Cards */}
          <div className="card-grid card-grid-4" style={{ marginBottom: '24px' }}>
            <div className="card">
              <span className="card-title">Current Meal Slot</span>
              <div className="stat-value" style={{ color: 'var(--accent-primary)', fontSize: '24px', marginTop: '6px' }}>
                {adaptiveData?.time_slot || 'Lunch'}
              </div>
              <div className="stat-label">
                Menu tailored for current campus dining hours
              </div>
            </div>

            <div className="card">
              <span className="card-title">Remaining Protein Goal</span>
              <div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>
                {adaptiveContext.remaining_protein || 0}<span className="stat-unit">g</span>
              </div>
              <div className="stat-label">
                Consumed {adaptiveContext.protein_consumed || 0}g of {adaptiveContext.daily_protein_target || 50}g target
              </div>
            </div>

            <div className="card">
              <span className="card-title">Remaining Calories</span>
              <div className="stat-value" style={{ color: 'var(--text-primary)' }}>
                {adaptiveContext.remaining_calories || 0}<span className="stat-unit">kcal</span>
              </div>
              <div className="stat-label">
                Consumed {adaptiveContext.calories_consumed || 0} kcal today
              </div>
            </div>

            <div className="card">
              <span className="card-title">Today's Spend</span>
              <div className="stat-value" style={{ color: 'var(--accent-terracotta)' }}>
                ₹{adaptiveContext.today_spent || 0}
              </div>
              <div className="stat-label">
                Pacing against monthly allowance
              </div>
            </div>
          </div>

          {/* Adaptive Results Grid */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Active Context-Aware Suggestions ({adaptiveRecs.length})
                </h2>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Prioritizes remaining nutrient deficits and suppresses dishes logged in the past 48 hours for dietary variety
                </div>
              </div>
              <span className="badge badge-emerald">Live Context</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginTop: '12px' }}>
              {adaptiveRecs.map((food, index) => (
                <div
                  key={food.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-xs)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="badge badge-gray">#{index + 1} Choice</span>
                      <span className="badge badge-blue">Score {food.adaptive_score}</span>
                    </div>

                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {food.food_name}
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      {food.canteen} &bull; {food.category}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px', textAlign: 'center' }}>
                      <div style={{ padding: '8px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>PRICE</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-primary)' }}>₹{food.price_inr}</div>
                      </div>
                      <div style={{ padding: '8px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>CALORIES</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {food.calories_kcal ? `${Math.round(food.calories_kcal)}` : '—'}
                        </div>
                      </div>
                      <div style={{ padding: '8px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>PROTEIN</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                          {food.protein_g ? `${food.protein_g}g` : '—'}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      padding: '8px 12px',
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      marginBottom: '14px'
                    }}>
                      {food.primary_reason}
                    </div>
                  </div>

                  <button
                    onClick={() => handleQuickLog(food)}
                    disabled={loggingId === food.id}
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%' }}
                  >
                    {loggingId === food.id ? 'Recording...' : `+ Log Meal (₹${food.price_inr})`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* COSINE SIMILARITY TAB */}
      {activeTab === 'cosine' && (
        <div>
          {/* Cold Start Notice */}
          {inputs.cold_start && (
            <div className="editorial-callout" style={{ borderLeftColor: 'var(--accent-primary)' }}>
              <div className="editorial-callout-title">Cold-Start Calibration Active</div>
              <div className="editorial-callout-text">
                Fewer than 5 meals logged in history. Recommendations are calibrated directly from your user profile targets ({inputs.user_avg_calories} kcal, {inputs.user_avg_protein}g protein, ₹{inputs.user_avg_price} budget pace) and selected slider priorities below.
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 340px) 1fr', gap: '28px', alignItems: 'start' }}>
            {/* Controls Card */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Priority Weights</span>
                <button
                  onClick={() => {
                    setMaxPrice(150);
                    setProteinPriority(0.7);
                    setCaloriePriority(0.5);
                    setPreferLowCalorie(false);
                    setCanteen('');
                    setCategory('');
                  }}
                  className="btn btn-sm btn-secondary"
                >
                  Reset
                </button>
              </div>

              {/* Max Price */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Max Budget per Item</label>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>₹{maxPrice}</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="250"
                  step="5"
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                />
              </div>

              {/* Protein Priority Slider */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Protein Priority</label>
                  <span style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{Math.round(proteinPriority * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
                  value={proteinPriority}
                  onChange={(e) => setProteinPriority(Number(e.target.value))}
                />
              </div>

              {/* Calorie Priority Slider */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Calorie Alignment</label>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round(caloriePriority * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  style={{ width: '100%', accentColor: 'var(--text-primary)' }}
                  value={caloriePriority}
                  onChange={(e) => setCaloriePriority(Number(e.target.value))}
                />
              </div>

              {/* Low Calorie Toggle */}
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="lowCal"
                  checked={preferLowCalorie}
                  onChange={(e) => setPreferLowCalorie(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                />
                <label htmlFor="lowCal" style={{ fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  Prefer Lower Calorie Options
                </label>
              </div>

              {/* Canteen & Category */}
              <div className="form-group">
                <label className="form-label">Canteen</label>
                <select
                  className="form-select"
                  value={canteen}
                  onChange={(e) => setCanteen(e.target.value)}
                >
                  <option value="">All Canteens</option>
                  {canteens.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Recommendations List */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Cosine-Ranked Recommendations ({recommendations.length})
                  </h2>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Ranked by similarity score (1.000 = exact multi-attribute alignment)
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <span>Calculating cosine similarity rankings...</span>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-title">No recommendations match your filters</div>
                  <div className="empty-state-text">Try raising the maximum price or selecting "All Canteens".</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {recommendations.map((food, index) => {
                    const scorePercent = Math.round(food.similarity_score * 100);
                    return (
                      <div
                        key={food.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: 'var(--shadow-xs)'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span className="badge badge-gray">#{index + 1} Rank</span>
                            <span className="badge badge-emerald">{scorePercent}% match</span>
                          </div>

                          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '2px', color: 'var(--text-primary)' }}>
                            {food.food_name}
                          </h3>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            {food.canteen} &bull; {food.category}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '12px', textAlign: 'center' }}>
                            <div style={{ background: 'var(--bg-canvas)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PRICE</div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-primary)' }}>₹{food.price_inr}</div>
                            </div>
                            <div style={{ background: 'var(--bg-canvas)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>KCAL</div>
                              <div style={{ fontSize: '14px', fontWeight: 700 }}>
                                {food.calories_kcal ? `${Math.round(food.calories_kcal)}` : '—'}
                              </div>
                            </div>
                            <div style={{ background: 'var(--bg-canvas)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PROT</div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                                {food.protein_g ? `${food.protein_g}g` : '—'}
                              </div>
                            </div>
                          </div>

                          <div style={{
                            padding: '8px 10px',
                            background: 'var(--bg-canvas)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '11.5px',
                            color: 'var(--text-secondary)',
                            marginBottom: '12px'
                          }}>
                            {food.reason}
                          </div>
                        </div>

                        <button
                          onClick={() => handleQuickLog(food)}
                          disabled={loggingId === food.id}
                          className="btn btn-primary btn-sm"
                          style={{ width: '100%' }}
                        >
                          {loggingId === food.id ? 'Recording...' : `+ Log (₹${food.price_inr})`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
