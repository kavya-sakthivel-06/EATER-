'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LogFoodPage() {
  const [foods, setFoods] = useState([]);
  const [canteens, setCanteens] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCanteen, setSelectedCanteen] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState(null);

  // Form State
  const [quantity, setQuantity] = useState(1);
  const [logDate, setLogDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Today's Recent Logs
  const [recentLogs, setRecentLogs] = useState([]);
  const [editingLog, setEditingLog] = useState(null);
  const [editQuantity, setEditQuantity] = useState(1);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch foods
  const fetchFoods = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCanteen) params.append('canteen', selectedCanteen);
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/foods?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch foods');
      const data = await res.json();
      setFoods(data.foods || []);
      if (canteens.length === 0) setCanteens(data.canteens || []);
      if (categories.length === 0) setCategories(data.categories || []);
    } catch (err) {
      console.error(err);
      showToast('Error loading menu', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch today's food logs
  const fetchRecentLogs = async () => {
    try {
      const res = await fetch('/api/food-logs?filter=today');
      if (res.ok) {
        const data = await res.json();
        setRecentLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFoods();
  }, [selectedCanteen, selectedCategory, searchQuery]);

  useEffect(() => {
    fetchRecentLogs();
    const now = new Date();
    setLogDate(new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  }, []);

  const handleSelectFood = (food) => {
    setSelectedFood(food);
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFood) {
      showToast('Please select a food item first', 'warning');
      return;
    }
    if (quantity <= 0) {
      showToast('Quantity must be greater than 0', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_db_id: selectedFood.id,
          quantity: Number(quantity),
          logged_at: new Date(logDate).toISOString(),
          source: 'manual',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to log food');
      }

      showToast(`Logged ${quantity}x ${selectedFood.food_name}!`, 'success');
      setSelectedFood(null);
      setQuantity(1);
      await fetchRecentLogs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLog = async (id) => {
    if (!confirm('Are you sure you want to delete this log?')) return;
    try {
      const res = await fetch(`/api/food-logs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Log entry removed', 'success');
      await fetchRecentLogs();
    } catch (err) {
      showToast('Could not delete log', 'error');
    }
  };

  const handleUpdateLogQuantity = async (id) => {
    if (editQuantity <= 0) return;
    try {
      const res = await fetch(`/api/food-logs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(editQuantity) }),
      });
      if (!res.ok) throw new Error('Failed to update');
      showToast('Quantity updated successfully', 'success');
      setEditingLog(null);
      await fetchRecentLogs();
    } catch (err) {
      showToast('Could not update quantity', 'error');
    }
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
          <h1 className="page-title">Log Campus Meal</h1>
          <p className="page-subtitle">
            Search authenticated campus menus, select servings, and record price & nutrition snapshots.
          </p>
        </div>
        <div>
          <Link href="/" className="btn btn-secondary">
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '28px', marginBottom: '32px' }}>
        
        {/* Step 1: Food Selection & Search */}
        <div className="card">
          <div className="card-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>1. Select Food from Catalogue</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Filter by canteen, category, or search dish name
              </div>
            </div>
            <span className="badge badge-gray">{foods.length} items</span>
          </div>

          {/* Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">Canteen</label>
              <select
                className="form-select"
                value={selectedCanteen}
                onChange={(e) => setSelectedCanteen(e.target.value)}
              >
                <option value="">All Canteens</option>
                {canteens.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Search Food Item</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Dosa, Thali, Paneer, Coffee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Food List */}
          <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '6px' }}>
            {foods.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                No dishes match your selected filters.
              </div>
            ) : (
              foods.map((food) => {
                const isSelected = selectedFood?.id === food.id;
                return (
                  <div
                    key={food.id}
                    onClick={() => handleSelectFood(food)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '6px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--accent-primary-tint)' : '#ffffff',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        {food.food_name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                        <span>{food.canteen}</span>
                        <span>•</span>
                        <span>{food.category}</span>
                        {food.serving_description && (
                          <>
                            <span>•</span>
                            <span>{food.serving_description}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '15px' }}>
                        ₹{food.price_inr}
                      </div>
                      <span className={`badge ${food.calories_kcal != null ? 'badge-emerald' : 'badge-amber'}`} style={{ fontSize: '10.5px' }}>
                        {food.calories_kcal != null ? `${Math.round(food.calories_kcal)} kcal` : 'Unverified'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Step 2: Quantity, Time & Confirmation Summary */}
        <div className="card">
          <div className="card-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>2. Serving & Snapshot Confirmation</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Review live calculated totals before recording to database
              </div>
            </div>
          </div>

          {selectedFood ? (
            <form onSubmit={handleLogSubmit}>
              {/* Selected Food Summary Box */}
              <div style={{ background: 'var(--bg-canvas)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '20px', border: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="badge badge-blue" style={{ marginBottom: '6px' }}>{selectedFood.canteen}</span>
                    <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedFood.food_name}</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Category: {selectedFood.category} {selectedFood.serving_description ? `• Serving: ${selectedFood.serving_description}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                      ₹{selectedFood.price_inr}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>per serving</div>
                  </div>
                </div>

                {/* Missing Nutrition Notice (Spec requirement 10) */}
                {selectedFood.calories_kcal == null && (
                  <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--accent-amber-tint)', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', color: 'var(--accent-amber)' }}>
                    <strong>Notice:</strong> This menu dish does not have verified calorie/protein metrics yet. It will not silently count as zero in your dashboard totals.
                  </div>
                )}
              </div>

              {/* Quantity Stepper & Timestamp */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Servings / Quantity</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '40px', padding: 0 }}
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      className="form-input"
                      style={{ textAlign: 'center', fontWeight: 700, fontSize: '16px' }}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '40px', padding: 0 }}
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Date & Time</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Real-time Calculated Snapshot Preview */}
              <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px', background: '#ffffff' }}>
                <div style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '10px' }}>
                  Log Snapshot ({quantity} serving{quantity > 1 ? 's' : ''})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
                  <div style={{ padding: '10px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Cost</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                      ₹{selectedFood.price_inr * quantity}
                    </div>
                  </div>

                  <div style={{ padding: '10px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Calories</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {selectedFood.calories_kcal ? `${Math.round(selectedFood.calories_kcal * quantity)} kcal` : 'Pending'}
                    </div>
                  </div>

                  <div style={{ padding: '10px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Protein</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                      {selectedFood.protein_g ? `${Math.round(selectedFood.protein_g * quantity)} g` : 'Pending'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Recording...' : `Record Meal Entry (₹${selectedFood.price_inr * quantity})`}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedFood(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="empty-state">
              <div className="empty-state-title">Select a food item</div>
              <div className="empty-state-text">
                Choose any item from the left campus menu to set portions and confirm your log entry.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today's Logged Items with In-line Edit & Delete (Priority 2) */}
      <div className="card">
        <div className="card-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>Today's Recorded Food Logs ({recentLogs.length})</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Edit servings or remove entries — dashboard metrics update in real-time
            </div>
          </div>
        </div>

        {recentLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13.5px' }}>
            No food logged today yet. Use the selector above to record your first meal.
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Food Item</th>
                  <th>Canteen</th>
                  <th>Quantity</th>
                  <th>Price Snapshot</th>
                  <th>Calories</th>
                  <th>Protein</th>
                  <th>Logged Time</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => {
                  const logTime = new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isEditing = editingLog?.id === log.id;

                  return (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600 }}>{log.food_name_snapshot}</td>
                      <td>
                        <span className="badge badge-gray">{log.canteen_snapshot}</span>
                      </td>
                      <td>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="number"
                              min="1"
                              className="form-input"
                              style={{ width: '60px', padding: '4px 8px' }}
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            />
                            <button
                              onClick={() => handleUpdateLogQuantity(log.id)}
                              className="btn btn-sm btn-primary"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingLog(null)}
                              className="btn btn-sm btn-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span>{log.quantity}x</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>₹{log.price_snapshot}</td>
                      <td>
                        {log.calories_snapshot != null ? (
                          <span>{Math.round(log.calories_snapshot)} kcal</span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Not recorded</span>
                        )}
                      </td>
                      <td>
                        {log.protein_snapshot != null ? (
                          <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{Math.round(log.protein_snapshot)} g</span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Not recorded</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>{logTime}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {!isEditing && (
                            <button
                              onClick={() => {
                                setEditingLog(log);
                                setEditQuantity(log.quantity);
                              }}
                              className="btn btn-sm btn-secondary"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="btn btn-sm btn-secondary"
                            style={{ color: 'var(--accent-rose)' }}
                          >
                            Remove
                          </button>
                        </div>
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
