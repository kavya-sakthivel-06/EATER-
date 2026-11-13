
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const getLocalDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

async function readResponse(response) {
  const text = await response.text();

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Invalid server response' };
  }

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `Request failed (${response.status})`
    );
  }

  return data;
}
// Convert different API/database field names into one consistent format.
function getNutritionValue(food, possibleKeys) {
  for (const key of possibleKeys) {
    const value = food?.[key];

    if (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }

  return null;
}

function normalizeFood(food) {
  return {
    ...food,

    calories_kcal: getNutritionValue(food, [
      'calories_kcal',
      'calories',
      'calorie',
    ]),

    protein_g: getNutritionValue(food, [
      'protein_g',
      'protein',
    ]),

    carbs_g: getNutritionValue(food, [
      'carbs_g',
      'carbohydrates_g',
      'carbs',
    ]),

    fat_g: getNutritionValue(food, [
      'fat_g',
      'fat',
    ]),

    sugar_g: getNutritionValue(food, [
      'sugar_g',
      'sugar',
    ]),

    fiber_g: getNutritionValue(food, [
      'fiber_g',
      'fibre_g',
      'fiber',
      'fibre',
    ]),
  };
}
export default function LogFoodPage() {
  const [foods, setFoods] = useState([]);
  const [canteens, setCanteens] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCanteen, setSelectedCanteen] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState(null);

  const [quantity, setQuantity] = useState(1);
  const [logDate, setLogDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toast, setToast] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [editingLog, setEditingLog] = useState(null);
  const [editQuantity, setEditQuantity] = useState(1);
  const [busyLogId, setBusyLogId] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Initialize the date/time in the user's local timezone.
  useEffect(() => {
    setLogDate(getLocalDateTime());
  }, []);

  // Load the food catalogue when filters change.
  useEffect(() => {
    const controller = new AbortController();

    async function loadFoods() {
      setLoading(true);

      try {
        const params = new URLSearchParams();

        if (selectedCanteen) params.set('canteen', selectedCanteen);
        if (selectedCategory) params.set('category', selectedCategory);
        if (searchQuery.trim()) params.set('search', searchQuery.trim());

        const response = await fetch(
          `/api/foods?${params.toString()}`,
          { signal: controller.signal }
        );

        const data = await readResponse(response);
        console.log("FIRST FOOD FROM API:", data.foods?.[0]);
console.log("ALL FOOD API DATA:", data.foods);

const normalizedFoods = Array.isArray(data.foods)
  ? data.foods.map(normalizeFood)
  : [];

console.log('API food response:', data.foods);
console.log('Normalized food response:', normalizedFoods);

setFoods(normalizedFoods);        setCanteens(Array.isArray(data.canteens) ? data.canteens : []);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Food catalogue error:', error);
          showToast(error.message || 'Unable to load food menu', 'error');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadFoods();

    return () => controller.abort();
  }, [selectedCanteen, selectedCategory, searchQuery, showToast]);

  const fetchRecentLogs = useCallback(async () => {
    setLogsLoading(true);

    try {
      const response = await fetch('/api/food-logs?filter=today');
      const data = await readResponse(response);

      setRecentLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (error) {
      console.error('Food log loading error:', error);
      showToast(error.message || 'Unable to load recent logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRecentLogs();
  }, [fetchRecentLogs]);

  const handleLogSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFood) {
      showToast('Please select a food item first', 'warning');
      return;
    }

    const servings = Number(quantity);
    const date = new Date(logDate);

    if (!Number.isInteger(servings) || servings < 1 || servings > 20) {
      showToast('Quantity must be between 1 and 20', 'warning');
      return;
    }

    if (!logDate || Number.isNaN(date.getTime())) {
      showToast('Please select a valid date and time', 'warning');
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_db_id: selectedFood.id,
          quantity: servings,
          logged_at: date.toISOString(),
          source: 'manual',
        }),
      });

      await readResponse(response);

      showToast(`Logged ${servings}x ${selectedFood.food_name}!`);

      setSelectedFood(null);
      setQuantity(1);

      await fetchRecentLogs();
    } catch (error) {
      console.error('Food logging error:', error);
      showToast(error.message || 'Failed to save food log', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLog = async (id) => {
    if (busyLogId !== null) return;

    if (!window.confirm('Are you sure you want to delete this log?')) {
      return;
    }

    setBusyLogId(id);

    try {
      const response = await fetch(`/api/food-logs/${id}`, {
        method: 'DELETE',
      });

      await readResponse(response);

      setRecentLogs((previous) =>
        previous.filter((log) => log.id !== id)
      );

      if (editingLog?.id === id) setEditingLog(null);

      showToast('Food log removed successfully');
    } catch (error) {
      console.error('Delete log error:', error);
      showToast(error.message || 'Could not delete food log', 'error');
    } finally {
      setBusyLogId(null);
    }
  };

  const handleUpdateLogQuantity = async (id) => {
    const servings = Number(editQuantity);

    if (!Number.isInteger(servings) || servings < 1 || servings > 20) {
      showToast('Quantity must be between 1 and 20', 'warning');
      return;
    }

    if (busyLogId !== null) return;

    setBusyLogId(id);

    try {
      const response = await fetch(`/api/food-logs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: servings }),
      });

      await readResponse(response);

      setEditingLog(null);
      showToast('Quantity updated successfully');

      // Reload server-calculated price and nutrition snapshots.
      await fetchRecentLogs();
    } catch (error) {
      console.error('Update log error:', error);
      showToast(error.message || 'Could not update quantity', 'error');
    } finally {
      setBusyLogId(null);
    }
  };

  const money = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : '—';
  };

const selectedCalories = selectedFood?.calories_kcal ?? null;
const selectedProtein = selectedFood?.protein_g ?? null;
const selectedCarbs = selectedFood?.carbs_g ?? null;
const selectedFat = selectedFood?.fat_g ?? null;
const selectedSugar = selectedFood?.sugar_g ?? null;
const selectedFiber = selectedFood?.fiber_g ?? null;
  const totalCost = Number(selectedFood?.price_inr || 0) * quantity;

  return (
    <div>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`toast toast-${toast.type}`}
        >
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            style={{ marginLeft: 12 }}
          >
            ×
          </button>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Log Campus Meal</h1>
          <p className="page-subtitle">
            Select a campus dish, choose your servings, and record
            your meal with price and nutrition snapshots.
          </p>
        </div>

        <Link href="/" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: 24,
          marginBottom: 32,
        }}
      >
        {/* STEP 1: SELECT FOOD */}
        <section className="card">
          <div className="card-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                1. Select Food
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Filter by canteen, category or dish name.
              </div>
            </div>

            <span className="badge badge-gray">
              {loading ? 'Loading…' : `${foods.length} items`}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <label className="form-label" htmlFor="canteen">
                Canteen
              </label>
              <select
                id="canteen"
                className="form-select"
                value={selectedCanteen}
                onChange={(e) => setSelectedCanteen(e.target.value)}
              >
                <option value="">All Canteens</option>
                {canteens.map((canteen) => (
                  <option key={canteen} value={canteen}>
                    {canteen}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" htmlFor="category">
                Category
              </label>
              <select
                id="category"
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="food-search">
              Search Food
            </label>
            <input
              id="food-search"
              className="form-input"
              type="search"
              placeholder="Dosa, Thali, Paneer, Coffee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div
            style={{
              maxHeight: 380,
              overflowY: 'auto',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: 6,
            }}
          >
            {loading ? (
              <p style={{ padding: 24, textAlign: 'center' }}>
                Loading campus menu…
              </p>
            ) : foods.length === 0 ? (
              <p style={{ padding: 24, textAlign: 'center' }}>
                No dishes found. Try changing your filters.
              </p>
            ) : (
              foods.map((food) => {
                const isSelected = selectedFood?.id === food.id;

                return (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => {
                      setSelectedFood(food);
                      setQuantity(1);
                    }}
                    aria-pressed={isSelected}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 12,
                      marginBottom: 6,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      background: isSelected
                        ? 'var(--accent-primary-tint)'
                        : 'var(--bg-canvas)',
                      color: 'var(--text-primary)',
                      border: isSelected
                        ? '1px solid var(--accent-primary)'
                        : '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <span>
                      <strong>{food.food_name}</strong>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          marginTop: 4,
                        }}
                      >
                        {food.canteen} · {food.category}
                        {food.serving_description
                          ? ` · ${food.serving_description}`
                          : ''}
                      </span>
                    </span>

                    <span style={{ textAlign: 'right', flexShrink: 0 }}>
                      <strong>₹{money(food.price_inr)}</strong>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 11,
                          color: 'var(--text-muted)',
                        }}
                      >
                        {food.calories_kcal != null
                          ? `${Math.round(Number(food.calories_kcal))} kcal`
                          : 'Nutrition pending'}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* STEP 2: CONFIRM AND SAVE */}
        <section className="card">
          <div className="card-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                2. Confirm Your Meal
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Review servings, cost and available nutrition data.
              </div>
            </div>
          </div>

          {!selectedFood ? (
            <div className="empty-state">
              <div className="empty-state-title">
                Select a food item
              </div>
              <div className="empty-state-text">
                Choose a dish from the menu to continue.
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogSubmit}>
              <div
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <span className="badge badge-blue">
                  {selectedFood.canteen}
                </span>

                <h3 style={{ marginTop: 8, fontSize: 18 }}>
                  {selectedFood.food_name}
                </h3>

                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selectedFood.category}
                  {selectedFood.serving_description
                    ? ` · ${selectedFood.serving_description}`
                    : ''}
                </p>

                <p style={{ marginTop: 10, fontWeight: 700 }}>
                  ₹{money(selectedFood.price_inr)} per serving
                </p>

                {selectedCalories == null && (
                  <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                    Nutrition data not provided; values will be shown as pending.
                  </p>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="quantity">
                    Servings (1–20)
                  </label>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={quantity <= 1}
                      onClick={() =>
                        setQuantity((current) => Math.max(1, current - 1))
                      }
                    >
                      −
                    </button>

                    <input
                      id="quantity"
                      className="form-input"
                      type="number"
                      min="1"
                      max="20"
                      step="1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />

                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={Number(quantity) >= 20}
                      onClick={() =>
                        setQuantity((current) =>
                          Math.min(20, Number(current) + 1)
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="log-date">
                    Date and Time
                  </label>
                  <input
                    id="log-date"
                    className="form-input"
                    type="datetime-local"
                    required
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <strong>
                  Meal Snapshot · {quantity} serving
                  {Number(quantity) === 1 ? '' : 's'}
                </strong>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <div>
                    <small>Total Cost</small>
                    <div style={{ fontWeight: 800, marginTop: 5 }}>
                      ₹{money(totalCost)}
                    </div>
                  </div>

                  <div>
                    <small>Calories</small>
                    <div style={{ fontWeight: 800, marginTop: 5 }}>
                      {selectedCalories != null &&
                      Number.isFinite(Number(selectedCalories))
                        ? `${Math.round(Number(selectedCalories) * Number(quantity))} kcal`
                        : 'Pending'}
                    </div>
                  </div>

                  <div>
                    <small>Protein</small>
                    <div style={{ fontWeight: 800, marginTop: 5 }}>
                      {selectedProtein != null &&
                      Number.isFinite(Number(selectedProtein))
                        ? `${(Number(selectedProtein) * Number(quantity)).toFixed(1)} g`
                        : 'Pending'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={
                    isSubmitting ||
                    !Number.isInteger(Number(quantity)) ||
                    Number(quantity) < 1 ||
                    Number(quantity) > 20 ||
                    !logDate
                  }
                >
                  {isSubmitting
                    ? 'Saving meal…'
                    : `Record Meal · ₹${money(totalCost)}`}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => {
                    setSelectedFood(null);
                    setQuantity(1);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {/* RECENT FOOD LOGS */}
      <section className="card">
        <div className="card-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              Today's Food Logs ({recentLogs.length})
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Edit servings or remove a recorded entry.
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchRecentLogs}
            disabled={logsLoading}
          >
            {logsLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {logsLoading ? (
          <p style={{ padding: 24, textAlign: 'center' }}>
            Loading your food logs…
          </p>
        ) : recentLogs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            No food logged today yet. Record your first meal above.
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
                  <th>Logged Time</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {recentLogs.map((log) => {
                  const isEditing = editingLog?.id === log.id;
                  const logDate = new Date(log.logged_at);
                  const timeLabel = Number.isNaN(logDate.getTime())
                    ? '—'
                    : logDate.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                  return (
                    <tr key={log.id}>
                      <td>
                        {log.food_name_snapshot || 'Unknown food'}
                      </td>

                      <td>{log.canteen_snapshot || '—'}</td>

                      <td>
                        {isEditing ? (
                          <input
                            className="form-input"
                            type="number"
                            min="1"
                            max="20"
                            step="1"
                            style={{ width: 80 }}
                            value={editQuantity}
                            onChange={(e) =>
                              setEditQuantity(e.target.value)
                            }
                          />
                        ) : (
                          `${log.quantity}x`
                        )}
                      </td>

                      <td>
                        ₹{money(log.price_snapshot)}
                      </td>

                      <td>
                        {log.calories_snapshot != null
                          ? `${Math.round(Number(log.calories_snapshot))} kcal`
                          : 'Not recorded'}
                      </td>

                      <td>
                        {log.protein_snapshot != null
                          ? `${Number(log.protein_snapshot).toFixed(1)} g`
                          : 'Not recorded'}
                      </td>

                      <td>{timeLabel}</td>

                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={busyLogId !== null}
                                onClick={() =>
                                  handleUpdateLogQuantity(log.id)
                                }
                              >
                                Save
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                disabled={busyLogId !== null}
                                onClick={() => setEditingLog(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setEditingLog(log);
                                setEditQuantity(log.quantity);
                              }}
                            >
                              Edit
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            disabled={busyLogId !== null}
                            onClick={() => handleDeleteLog(log.id)}
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
      </section>
    </div>
  );
}
