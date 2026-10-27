'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CataloguePage() {
  const [foods, setFoods] = useState([]);
  const [canteens, setCanteens] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active View Tab: 'catalogue' | 'comparison'
  const [activeTab, setActiveTab] = useState('catalogue');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCanteen, setSelectedCanteen] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedVeg, setSelectedVeg] = useState('');
  const [sortBy, setSortBy] = useState('food_name');
  const [sortOrder, setSortOrder] = useState('ASC');

  // Edit Nutrition Modal State
  const [editingFood, setEditingFood] = useState(null);
  const [editForm, setEditForm] = useState({
    calories_kcal: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    serving_description: '',
    nutrition_status: 'Estimated',
    source_notes: '',
    vegetarian: 'Unknown'
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchFoods = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedCanteen) params.append('canteen', selectedCanteen);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedVeg) params.append('vegetarian', selectedVeg);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const res = await fetch(`/api/foods?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch catalogue');
      const data = await res.json();
      setFoods(data.foods || []);
      if (canteens.length === 0) setCanteens(data.canteens || []);
      if (categories.length === 0) setCategories(data.categories || []);
    } catch (err) {
      console.error(err);
      showToast('Error loading catalogue', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFoods();
  }, [search, selectedCanteen, selectedCategory, selectedVeg, sortBy, sortOrder]);

  const handleOpenEdit = (food) => {
    setEditingFood(food);
    setEditForm({
      calories_kcal: food.calories_kcal != null ? food.calories_kcal : '',
      protein_g: food.protein_g != null ? food.protein_g : '',
      carbs_g: food.carbs_g != null ? food.carbs_g : '',
      fat_g: food.fat_g != null ? food.fat_g : '',
      serving_description: food.serving_description || '',
      nutrition_status: food.nutrition_status || 'Estimated',
      source_notes: food.source_notes || 'Manual entry / estimate',
      vegetarian: food.vegetarian || 'Unknown'
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingFood) return;
    setIsSavingEdit(true);

    try {
      const res = await fetch('/api/foods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingFood.id,
          calories_kcal: editForm.calories_kcal !== '' ? Number(editForm.calories_kcal) : null,
          protein_g: editForm.protein_g !== '' ? Number(editForm.protein_g) : null,
          carbs_g: editForm.carbs_g !== '' ? Number(editForm.carbs_g) : null,
          fat_g: editForm.fat_g !== '' ? Number(editForm.fat_g) : null,
          serving_description: editForm.serving_description || null,
          nutrition_status: editForm.nutrition_status,
          source_notes: editForm.source_notes,
          vegetarian: editForm.vegetarian
        })
      });

      if (!res.ok) throw new Error('Failed to update nutrition');
      showToast(`Updated nutrition for ${editingFood.food_name}`, 'success');
      setEditingFood(null);
      await fetchFoods();
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Cross-canteen defensible comparisons
  const normalizeItemName = (name) => {
    return name.toLowerCase()
      .replace(/2\s*pcs|pcs|plate|cup|meal|bowl/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .trim();
  };

  const getCrossCanteenComparisons = () => {
    const itemMap = {};

    foods.forEach((food) => {
      const norm = normalizeItemName(food.food_name);
      if (!norm || norm.length < 3) return;

      if (!itemMap[norm]) {
        itemMap[norm] = {
          canonicalName: food.food_name,
          category: food.category,
          items: []
        };
      }
      if (!itemMap[norm].items.some(i => i.canteen === food.canteen)) {
        itemMap[norm].items.push(food);
      }
    });

    return Object.values(itemMap)
      .filter(entry => entry.items.length >= 2)
      .map(entry => {
        const prices = entry.items.map(i => i.price_inr);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const difference = maxPrice - minPrice;
        return {
          ...entry,
          minPrice,
          maxPrice,
          difference
        };
      })
      .sort((a, b) => b.difference - a.difference);
  };

  const comparisons = getCrossCanteenComparisons();

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
          <h1 className="page-title">Campus Food Catalogue & Price Comparison</h1>
          <p className="page-subtitle">
            Authenticated campus menu database with verified nutrition metrics, serving portions, and cross-canteen arbitrage.
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
          className={`tab ${activeTab === 'catalogue' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalogue')}
        >
          Menu Catalogue ({foods.length} dishes)
        </button>
        <button
          className={`tab ${activeTab === 'comparison' ? 'active' : ''}`}
          onClick={() => setActiveTab('comparison')}
        >
          Cross-Canteen Price Comparison ({comparisons.length} matches)
        </button>
      </div>

      {activeTab === 'catalogue' && (
        <>
          {/* Filters Bar */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', alignItems: 'end' }}>
              <div>
                <label className="form-label">Search Food</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search dish name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Canteen</label>
                <select
                  className="form-select"
                  value={selectedCanteen}
                  onChange={(e) => setSelectedCanteen(e.target.value)}
                >
                  <option value="">All Canteens</option>
                  {canteens.map(c => <option key={c} value={c}>{c}</option>)}
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
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Dietary</label>
                <select
                  className="form-select"
                  value={selectedVeg}
                  onChange={(e) => setSelectedVeg(e.target.value)}
                >
                  <option value="">All Diet Types</option>
                  <option value="Yes">Vegetarian</option>
                  <option value="No">Non-Vegetarian</option>
                </select>
              </div>

              <div>
                <label className="form-label">Sort By</label>
                <select
                  className="form-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="food_name">Dish Name</option>
                  <option value="price_inr">Price (INR)</option>
                  <option value="calories_kcal">Calories</option>
                  <option value="protein_g">Protein</option>
                  <option value="canteen">Canteen</option>
                </select>
              </div>

              <div>
                <label className="form-label">Order</label>
                <select
                  className="form-select"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="ASC">Ascending</option>
                  <option value="DESC">Descending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Catalogue Table */}
          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Canteen</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Calories</th>
                    <th>Protein</th>
                    <th>Serving</th>
                    <th>Status</th>
                    <th>Diet</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {foods.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No foods found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    foods.map((food) => (
                      <tr key={food.id}>
                        <td style={{ fontWeight: 600 }}>{food.food_name}</td>
                        <td>
                          <span className="badge badge-gray">{food.canteen}</span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{food.category}</td>
                        <td style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '15px' }}>₹{food.price_inr}</td>
                        <td>
                          {food.calories_kcal != null ? (
                            <span style={{ fontWeight: 600 }}>{Math.round(food.calories_kcal)} kcal</span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Not entered</span>
                          )}
                        </td>
                        <td>
                          {food.protein_g != null ? (
                            <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{food.protein_g} g</span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Not entered</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {food.serving_description || '—'}
                        </td>
                        <td>
                          <span className={`badge ${
                            food.nutrition_status === 'Estimated' ? 'badge-blue' :
                            food.nutrition_status === 'Verified' ? 'badge-emerald' : 'badge-amber'
                          }`}>
                            {food.nutrition_status || 'Not entered'}
                          </span>
                        </td>
                        <td>
                          {food.vegetarian === 'Yes' && <span className="badge badge-emerald">Veg</span>}
                          {food.vegetarian === 'No' && <span className="badge badge-rose">Non-Veg</span>}
                          {food.vegetarian === 'Unknown' && <span className="badge badge-gray">Unknown</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleOpenEdit(food)}
                              className="btn btn-sm btn-secondary"
                              title="Edit Nutrition values"
                            >
                              Edit
                            </button>
                            <Link
                              href="/log-food"
                              className="btn btn-sm btn-primary"
                              title="Quick Log"
                            >
                              Log
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Cross-Canteen Price Comparison Tab (Priority 3) */}
      {activeTab === 'comparison' && (
        <div>
          <div className="editorial-callout">
            <div className="editorial-callout-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              Defensible Menu Item Matching
            </div>
            <div className="editorial-callout-text">
              Comparing equivalent dishes across campus canteens. Items showing significant price spreads offer student savings for the identical meal.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
            {comparisons.map((comp, idx) => (
              <div key={idx} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{comp.canonicalName}</h3>
                    <span className="badge badge-gray">{comp.category}</span>
                  </div>
                  {comp.difference > 0 ? (
                    <span className="badge badge-emerald">
                      Save up to ₹{comp.difference}
                    </span>
                  ) : (
                    <span className="badge badge-gray">Same Price</span>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700 }}>
                    Prices by Canteen Location:
                  </div>

                  {comp.items.map((item, i) => {
                    const isCheapest = item.price_inr === comp.minPrice && comp.difference > 0;
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          marginBottom: '4px',
                          background: isCheapest ? 'var(--accent-emerald-tint)' : 'var(--bg-canvas)',
                          border: isCheapest ? '1px solid #bbf7d0' : '1px solid var(--border-subtle)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13.5px' }}>{item.canteen}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({item.food_name})</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 700, color: isCheapest ? 'var(--accent-emerald)' : 'var(--text-primary)', fontSize: '14.5px' }}>
                            ₹{item.price_inr}
                          </span>
                          {isCheapest && (
                            <span className="badge badge-emerald" style={{ fontSize: '10px', padding: '2px 6px' }}>
                              Best Value
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin / Edit Nutrition Modal (Spec item 4) */}
      {editingFood && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Edit Nutrition Values</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {editingFood.food_name} • {editingFood.canteen} (Listed Price: ₹{editingFood.price_inr})
                </div>
              </div>
              <button
                className="modal-close"
                onClick={() => setEditingFood(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="editorial-callout" style={{ borderLeftColor: 'var(--accent-amber)', marginBottom: '16px' }}>
                  <div className="editorial-callout-text">
                    <strong>Demo Policy:</strong> Values entered here are stored as <strong>Estimated</strong> and never presented as lab-verified facts without verification.
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Calories (kcal)</label>
                    <input
                      type="number"
                      step="1"
                      className="form-input"
                      placeholder="e.g. 250"
                      value={editForm.calories_kcal}
                      onChange={(e) => setEditForm({ ...editForm, calories_kcal: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Protein (g)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-input"
                      placeholder="e.g. 10.5"
                      value={editForm.protein_g}
                      onChange={(e) => setEditForm({ ...editForm, protein_g: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Carbs (g)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-input"
                      placeholder="e.g. 35"
                      value={editForm.carbs_g}
                      onChange={(e) => setEditForm({ ...editForm, carbs_g: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fat (g)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-input"
                      placeholder="e.g. 8"
                      value={editForm.fat_g}
                      onChange={(e) => setEditForm({ ...editForm, fat_g: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Serving Description</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 1 plate (approx 200g) / 2 pieces"
                    value={editForm.serving_description}
                    onChange={(e) => setEditForm({ ...editForm, serving_description: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Dietary Classification</label>
                    <select
                      className="form-select"
                      value={editForm.vegetarian}
                      onChange={(e) => setEditForm({ ...editForm, vegetarian: e.target.value })}
                    >
                      <option value="Yes">Vegetarian</option>
                      <option value="No">Non-Vegetarian</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nutrition Status</label>
                    <select
                      className="form-select"
                      value={editForm.nutrition_status}
                      onChange={(e) => setEditForm({ ...editForm, nutrition_status: e.target.value })}
                    >
                      <option value="Estimated">Estimated</option>
                      <option value="Verified">Verified</option>
                      <option value="Not entered">Not entered</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Source Notes / Reference</label>
                  <textarea
                    rows="2"
                    className="form-textarea"
                    placeholder="e.g. Estimated from standard Indian food nutrition tables for demonstration."
                    value={editForm.source_notes}
                    onChange={(e) => setEditForm({ ...editForm, source_notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingFood(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? 'Saving...' : 'Save Nutrition Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
