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
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

const formatINR = (value) =>
  `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;

const formatNumber = (value) =>
  Math.round(Number(value) || 0).toLocaleString('en-IN');

function ProgressRing({ value = 0, color = '#315B40', label }) {
  const percentage = Math.min(Math.max(Number(value) || 0, 0), 100);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="universe-ring" aria-label={`${percentage}% ${label || 'complete'}`}>
      <svg viewBox="0 0 88 88" className="universe-ring-svg">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="#E9E5D9"
          strokeWidth="7"
        />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 44 44)"
          className="universe-ring-progress"
        />
        <text
          x="44"
          y="48"
          textAnchor="middle"
          className="universe-ring-text"
        >
          {percentage}%
        </text>
      </svg>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="universe-section-heading">
      <div>
        {eyebrow && <div className="universe-eyebrow">{eyebrow}</div>}
        <h2 className="universe-section-title">{title}</h2>
        {description && (
          <p className="universe-section-description">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter] = useState('today');
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
      showToast('Could not load your dashboard. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Refresh when the API filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  const handleDeleteLog = async (id) => {
    if (!confirm('Are you sure you want to remove this food log?')) return;

    setDeletingId(id);

    try {
      const res = await fetch(`/api/food-logs/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete food log');

      showToast('Food log removed successfully');
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      showToast('Could not remove this food log.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <>
        <div className="universe-loading">
          <div className="universe-loading-orbit">
            <span />
            <span />
            <span />
          </div>
          <p>Setting the table for your day...</p>
        </div>
        <style jsx>{`
          .universe-loading {
            min-height: 70vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 22px;
            color: #657064;
            font-size: 14px;
          }
          .universe-loading-orbit {
            width: 58px;
            height: 58px;
            border: 1px solid #d9dfd2;
            border-radius: 50%;
            display: grid;
            place-items: center;
            position: relative;
          }
          .universe-loading-orbit span {
            position: absolute;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #315b40;
            animation: orbit 1.3s ease-in-out infinite;
          }
          .universe-loading-orbit span:nth-child(2) {
            animation-delay: 0.2s;
          }
          .universe-loading-orbit span:nth-child(3) {
            animation-delay: 0.4s;
          }
          @keyframes orbit {
            0%, 100% { transform: translate(0, -18px) scale(.7); opacity: .45; }
            50% { transform: translate(0, 0) scale(1.15); opacity: 1; }
          }
        `}</style>
      </>
    );
  }

  const {
    today = {},
    month = {},
    targets = {},
    weeklyData = [],
    recentLogs = [],
    user = {},
  } = data || {};

  const calorieTarget = Number(targets?.calories?.target) || 2000;
  const proteinTarget = Number(targets?.protein?.target) || 50;
  const calorieValue = Number(today?.calories) || 0;
  const proteinValue = Number(today?.protein) || 0;
  const caloriePercent = Math.round((calorieValue / calorieTarget) * 100);
  const proteinPercent = Math.round((proteinValue / proteinTarget) * 100);

  const monthlySpend = Number(month?.spending) || 0;
  const monthlyBudget = Number(month?.budget) || 5000;
  const budgetPercent = Math.round((monthlySpend / monthlyBudget) * 100);
  const budgetRemaining = Number.isFinite(Number(month?.remaining))
    ? Number(month.remaining)
    : monthlyBudget - monthlySpend;

  const nutritionLabels = weeklyData.map((item) => {
    const date = new Date(item.date);
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
    });
  });

  const chartFont = {
    family: 'Plus Jakarta Sans, sans-serif',
    size: 11,
  };

  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'bottom',
        align: 'start',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 7,
          boxHeight: 7,
          padding: 18,
          color: '#62685E',
          font: chartFont,
        },
      },
      tooltip: {
        backgroundColor: '#263D2E',
        titleColor: '#FFFFFF',
        bodyColor: '#F4F0E6',
        padding: 12,
        cornerRadius: 10,
        displayColors: true,
      },
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: '#777B70',
          font: chartFont,
        },
      },
      y: {
        beginAtZero: true,
        border: { display: false, dash: [4, 4] },
        grid: { color: 'rgba(57, 75, 55, 0.08)' },
        ticks: {
          color: '#777B70',
          font: chartFont,
        },
      },
    },
  };

  const nutritionChartData = {
    labels: nutritionLabels,
    datasets: [
      {
        type: 'bar',
        label: 'Calories',
        data: weeklyData.map((item) => item.daily_calories || 0),
        backgroundColor: '#315B40',
        hoverBackgroundColor: '#24462F',
        borderRadius: 7,
        borderSkipped: false,
        maxBarThickness: 30,
        yAxisID: 'y',
      },
      {
        type: 'line',
        label: 'Protein (g)',
        data: weeklyData.map((item) => item.daily_protein || 0),
        borderColor: '#D17850',
        backgroundColor: '#D17850',
        borderWidth: 2.5,
        tension: 0.38,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBorderWidth: 2,
        pointBorderColor: '#FFFCF5',
        pointBackgroundColor: '#D17850',
        yAxisID: 'y1',
      },
    ],
  };

  const nutritionChartOptions = {
    ...commonChartOptions,
    scales: {
      ...commonChartOptions.scales,
      y: {
        ...commonChartOptions.scales.y,
        title: {
          display: true,
          text: 'Calories (kcal)',
          color: '#777B70',
          font: chartFont,
        },
      },
      y1: {
        beginAtZero: true,
        position: 'right',
        border: { display: false },
        grid: { display: false },
        ticks: { color: '#777B70', font: chartFont },
        title: {
          display: true,
          text: 'Protein (g)',
          color: '#777B70',
          font: chartFont,
        },
      },
    },
  };

  const spendingChartData = {
    labels: nutritionLabels,
    datasets: [
      {
        label: 'Daily spending',
        data: weeklyData.map((item) => item.daily_spending || 0),
        borderColor: '#C56A43',
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return 'rgba(197, 106, 67, 0.12)';

          const gradient = ctx.createLinearGradient(
            0,
            chartArea.top,
            0,
            chartArea.bottom
          );
          gradient.addColorStop(0, 'rgba(197, 106, 67, 0.25)');
          gradient.addColorStop(1, 'rgba(197, 106, 67, 0.01)');
          return gradient;
        },
        fill: true,
        tension: 0.38,
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBorderWidth: 2,
        pointBorderColor: '#FFFCF5',
        pointBackgroundColor: '#C56A43',
      },
    ],
  };

  const spendingChartOptions = {
    ...commonChartOptions,
    plugins: {
      ...commonChartOptions.plugins,
      tooltip: {
        ...commonChartOptions.plugins.tooltip,
        callbacks: {
          label: (context) =>
            ` ${context.dataset.label}: ${formatINR(context.parsed.y)}`,
        },
      },
    },
    scales: {
      ...commonChartOptions.scales,
      y: {
        ...commonChartOptions.scales.y,
        ticks: {
          ...commonChartOptions.scales.y.ticks,
          callback: (value) => `₹${value}`,
        },
        title: {
          display: true,
          text: 'Amount spent',
          color: '#777B70',
          font: chartFont,
        },
      },
    },
  };

  const loggedCount = Number(today?.items_logged) || 0;
  const verifiedCount = Number(today?.items_with_nutrition) || 0;
  const incompleteCount = Math.max(0, loggedCount - verifiedCount);

  return (
    <div className="food-universe">
      {toast && (
        <div
          className={`universe-toast ${toast.type === 'error' ? 'is-error' : ''}`}
          role="status"
        >
          <span className="universe-toast-dot" />
          {toast.message}
        </div>
      )}

      {/* Editorial hero */}
      <section className="universe-hero">
        <div className="universe-hero-content">
          <div className="universe-eyebrow universe-hero-eyebrow">
            <span className="universe-eyebrow-dot" />
            YOUR DAILY FOOD JOURNAL
          </div>

          <h1>
            A little more
            <br />
            <span>goodness,</span> every day.
          </h1>

          <p className="universe-hero-description">
            Hey {user?.name || 'Kavya'}! Keep track of what nourishes you
            and where your food budget goes.
          </p>

          <div className="universe-hero-actions">
            <Link href="/log-food" className="universe-button universe-button-dark">
              <span className="universe-button-plus">+</span>
              Log a meal
            </Link>
            <Link href="/recommendations" className="universe-text-link">
              Explore your food world <span>↗</span>
            </Link>
          </div>

          <div className="universe-hero-footnote">
            <span className="universe-sun">✳</span>
            Small choices. Better awareness.
          </div>
        </div>

        <div className="universe-hero-art" aria-hidden="true">
          <div className="universe-art-orbit universe-art-orbit-one" />
          <div className="universe-art-orbit universe-art-orbit-two" />
          <div className="universe-art-label">
            <span>GOOD FOOD</span>
            <span>GOOD MOOD</span>
          </div>
          <div className="universe-plate">
            <div className="universe-plate-inner">
              <div className="universe-food-food rice">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="universe-food-food greens">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="universe-food-food tomato">
                <span />
              </div>
              <div className="universe-food-food curry">
                <span />
                <span />
              </div>
              <div className="universe-food-food roti" />
            </div>
          </div>
          <div className="universe-floating-note universe-note-top">
            <span className="universe-note-icon">✳</span>
            <div>
              <strong>Eat mindfully</strong>
              <small>Your pace, your plate</small>
            </div>
          </div>
          <div className="universe-floating-note universe-note-bottom">
            <span className="universe-note-icon note-orange">↗</span>
            <div>
              <strong>Track your progress</strong>
              <small>One meal at a time</small>
            </div>
          </div>
          <span className="universe-art-spark universe-spark-one">✳</span>
          <span className="universe-art-spark universe-spark-two">✦</span>
        </div>
      </section>

      {/* Date and daily context */}
      <div className="universe-dayline">
        <div>
          <span className="universe-day-icon">☼</span>
          <span className="universe-day-label">
            YOUR DAY AT A GLANCE
          </span>
        </div>
        <span className="universe-current-date">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </span>
      </div>

      {/* Nutrition warning */}
      {today?.nutrition_incomplete && (
        <div className="universe-notice">
          <span className="universe-notice-icon">!</span>
          <div>
            <strong>A few meals are missing nutrition details</strong>
            <p>
              {incompleteCount} of {loggedCount} logged items lack verified
              nutrition values. These values are excluded from your totals
              rather than being treated as zero.
            </p>
          </div>
          <Link href="/log-food" className="universe-notice-link">
            Review logs ↗
          </Link>
        </div>
      )}

      {/* Main daily overview */}
      <SectionHeading
        eyebrow="THE DAILY MIX"
        title="Your plate, in numbers."
        description="A quick look at how today is shaping up."
      />

      <section className="universe-metrics">
        <article className="universe-metric universe-metric-primary">
          <div className="universe-metric-top">
            <span className="universe-metric-label">ENERGY INTAKE</span>
            <span className="universe-metric-icon">☼</span>
          </div>
          <div className="universe-metric-main">
            <div>
              <div className="universe-metric-number">
                {formatNumber(calorieValue)}
                <span>kcal</span>
              </div>
              <p className="universe-metric-support">
                of {formatNumber(calorieTarget)} kcal daily goal
              </p>
            </div>
            <ProgressRing
              value={caloriePercent}
              color="#315B40"
              label="calorie goal"
            />
          </div>
          <div className="universe-meter">
            <div
              className="universe-meter-fill"
              style={{
                width: `${Math.min(caloriePercent, 100)}%`,
                background: caloriePercent > 100 ? '#B84A37' : '#315B40',
              }}
            />
          </div>
          <div className="universe-metric-bottom">
            <span>Daily progress</span>
            <strong>
              {formatNumber(targets?.calories?.remaining ?? calorieTarget - calorieValue)} kcal left
            </strong>
          </div>
        </article>

        <article className="universe-metric universe-metric-protein">
          <div className="universe-metric-top">
            <span className="universe-metric-label">PROTEIN INTAKE</span>
            <span className="universe-metric-icon">✳</span>
          </div>
          <div className="universe-metric-main">
            <div>
              <div className="universe-metric-number">
                {formatNumber(proteinValue)}
                <span>g</span>
              </div>
              <p className="universe-metric-support">
                of {formatNumber(proteinTarget)} g daily goal
              </p>
            </div>
            <ProgressRing
              value={proteinPercent}
              color="#B96A45"
              label="protein goal"
            />
          </div>
          <div className="universe-meter">
            <div
              className="universe-meter-fill"
              style={{
                width: `${Math.min(proteinPercent, 100)}%`,
                background: '#B96A45',
              }}
            />
          </div>
          <div className="universe-metric-bottom">
            <span>Daily progress</span>
            <strong>
              {formatNumber(targets?.protein?.remaining ?? proteinTarget - proteinValue)} g left
            </strong>
          </div>
        </article>

        <article className="universe-metric universe-metric-spending">
          <div className="universe-metric-top">
            <span className="universe-metric-label">CAMPUS SPENDING</span>
            <span className="universe-metric-icon">₹</span>
          </div>
          <div className="universe-metric-number">
            {formatINR(today?.spending)}
          </div>
          <p className="universe-metric-support">
            Spent on food today
          </p>

          <div className="universe-budget-divider" />

          <div className="universe-budget-row">
            <span>Monthly budget used</span>
            <strong>{budgetPercent}%</strong>
          </div>
          <div className="universe-meter">
            <div
              className="universe-meter-fill"
              style={{
                width: `${Math.min(budgetPercent, 100)}%`,
                background: budgetPercent > 90 ? '#B84A37' : '#C56A43',
              }}
            />
          </div>
          <div className="universe-metric-bottom">
            <span>{formatINR(monthlySpend)} spent</span>
            <strong>{formatINR(budgetRemaining)} left</strong>
          </div>
        </article>

        <article className="universe-metric universe-metric-meals">
          <div className="universe-metric-top">
            <span className="universe-metric-label">TODAY'S FOOD JOURNAL</span>
            <span className="universe-metric-icon">✎</span>
          </div>
          <div className="universe-metric-number">
            {loggedCount}
            <span>{loggedCount === 1 ? 'meal' : 'meals'}</span>
          </div>
          <p className="universe-metric-support">
            {verifiedCount} {verifiedCount === 1 ? 'entry' : 'entries'} with
            nutrition data
          </p>

          <div className="universe-meal-status">
            <span className="universe-status-dot" />
            {loggedCount > 0 ? 'Your journal is underway' : 'Your journal is waiting'}
          </div>
          <Link href="/log-food" className="universe-meal-link">
            Add another meal <span>↗</span>
          </Link>
        </article>
      </section>

      {/* Analytics */}
      <SectionHeading
        eyebrow="LITTLE PATTERNS, BIG PICTURE"
        title="Your week, unfolding."
        description="See how your nutrition and campus spending change day by day."
      />

      <section className="universe-charts">
        <article className="universe-panel">
          <div className="universe-panel-heading">
            <div>
              <span className="universe-panel-kicker">01 / NOURISHMENT</span>
              <h3>Nutrition rhythm</h3>
              <p>Calories and protein across the past 7 days.</p>
            </div>
            <span className="universe-panel-decoration">✳</span>
          </div>
          <div className="universe-chart">
            {weeklyData.length > 0 ? (
              <Bar
                data={nutritionChartData}
                options={nutritionChartOptions}
              />
            ) : (
              <div className="universe-empty-chart">
                <span className="universe-empty-symbol">◌</span>
                <strong>Your week starts with one meal.</strong>
                <p>Log your food to begin building your nutrition history.</p>
                <Link href="/log-food" className="universe-inline-link">
                  Log your first meal ↗
                </Link>
              </div>
            )}
          </div>
        </article>

        <article className="universe-panel universe-panel-spending">
          <div className="universe-panel-heading">
            <div>
              <span className="universe-panel-kicker">02 / MONEY MATTERS</span>
              <h3>Where it goes</h3>
              <p>Your daily food spending over the past 7 days.</p>
            </div>
            <span className="universe-panel-decoration">↗</span>
          </div>
          <div className="universe-chart">
            {weeklyData.length > 0 ? (
              <Line
                data={spendingChartData}
                options={spendingChartOptions}
              />
            ) : (
              <div className="universe-empty-chart">
                <span className="universe-empty-symbol">₹</span>
                <strong>Your spending story starts here.</strong>
                <p>Log a canteen purchase to see your spending patterns.</p>
                <Link href="/log-food" className="universe-inline-link">
                  Record a purchase ↗
                </Link>
              </div>
            )}
          </div>
          <div className="universe-chart-footer">
            <span>Monthly budget</span>
            <strong>{formatINR(monthlyBudget)}</strong>
            <span className="universe-chart-footer-separator">·</span>
            <span>Remaining</span>
            <strong>{formatINR(budgetRemaining)}</strong>
          </div>
        </article>
      </section>

      {/* Food journal */}
      <section className="universe-journal-section">
        <SectionHeading
          eyebrow="FRESH FROM YOUR JOURNAL"
          title="Your recent bites."
          description="A record of what you ate, where you found it, and what it cost."
          action={
            <Link href="/log-food" className="universe-button universe-button-outline">
              + Log food
            </Link>
          }
        />

        <div className="universe-journal">
          {recentLogs.length === 0 ? (
            <div className="universe-journal-empty">
              <div className="universe-journal-empty-art">✳</div>
              <h3>Every food story starts somewhere.</h3>
              <p>
                Your food journal is empty for now. Add your first meal and
                start seeing your daily patterns take shape.
              </p>
              <Link href="/log-food" className="universe-button universe-button-dark">
                Log your first meal ↗
              </Link>
            </div>
          ) : (
            <>
              <div className="universe-journal-header">
                <span>FOOD & LOCATION</span>
                <span>QUANTITY</span>
                <span>PRICE</span>
                <span>NUTRITION</span>
                <span>TIME</span>
                <span>ACTION</span>
              </div>

              {recentLogs.map((log) => {
                const logDate = new Date(log.logged_at);
                const validDate = !Number.isNaN(logDate.getTime());
                const formattedTime = validDate
                  ? logDate.toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—';
                const formattedDate = validDate
                  ? logDate.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : '';

                const hasNutrition = log.calories_snapshot != null;
                const hasProtein = log.protein_snapshot != null;

                return (
                  <div className="universe-journal-row" key={log.id}>
                    <div className="universe-food-cell">
                      <div className="universe-food-avatar">
                        {(log.food_name_snapshot || 'F')
                          .trim()
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div className="universe-food-details">
                        <strong>{log.food_name_snapshot || 'Food item'}</strong>
                        <span>
                          {log.canteen_snapshot || 'Campus'}
                          {log.source === 'camera_confirmed' && (
                            <span className="universe-camera-tag">CAM</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="universe-journal-quantity">
                      {log.quantity}×
                    </div>

                    <div className="universe-journal-price">
                      {formatINR(log.price_snapshot)}
                    </div>

                    <div className="universe-journal-nutrition">
                      <strong>
                        {hasNutrition
                          ? `${formatNumber(log.calories_snapshot)} kcal`
                          : 'Not recorded'}
                      </strong>
                      <span>
                        {hasProtein
                          ? `${formatNumber(log.protein_snapshot)} g protein`
                          : 'Protein unavailable'}
                      </span>
                      <span
                        className={`universe-nutrition-tag ${
                          hasNutrition ? 'is-complete' : 'is-incomplete'
                        }`}
                      >
                        {hasNutrition ? 'Recorded' : 'Incomplete'}
                      </span>
                    </div>

                    <div className="universe-journal-time">
                      <strong>{formattedTime}</strong>
                      <span>{formattedDate}</span>
                    </div>

                    <div className="universe-journal-action">
                      <button
                        type="button"
                        onClick={() => handleDeleteLog(log.id)}
                        disabled={deletingId === log.id}
                        className="universe-delete-button"
                        title="Remove food log"
                        aria-label={`Remove ${log.food_name_snapshot || 'food log'}`}
                      >
                        {deletingId === log.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </section>

      {/* Quick links */}
      <section className="universe-discover">
        <div className="universe-discover-copy">
          <span className="universe-eyebrow">KEEP EXPLORING</span>
          <h2>Make your next food choice a little easier.</h2>
          <p>
            From smarter budgets to personalised suggestions, your next
            useful insight is just around the corner.
          </p>
        </div>
        <div className="universe-discover-links">
          <Link href="/recommendations" className="universe-discover-link">
            <span className="universe-discover-icon">✳</span>
            <span>
              <strong>Food recommendations</strong>
              <small>Find something worth trying</small>
            </span>
            <span className="universe-discover-arrow">↗</span>
          </Link>
          <Link href="/budget-optimizer" className="universe-discover-link">
            <span className="universe-discover-icon orange">₹</span>
            <span>
              <strong>Budget optimizer</strong>
              <small>Make your money go further</small>
            </span>
            <span className="universe-discover-arrow">↗</span>
          </Link>
          <Link href="/spending-coach" className="universe-discover-link">
            <span className="universe-discover-icon yellow">↗</span>
            <span>
              <strong>Spending coach</strong>
              <small>Understand your spending habits</small>
            </span>
            <span className="universe-discover-arrow">↗</span>
          </Link>
        </div>
      </section>

      <style jsx>{`
        .food-universe {
          --fu-ink: #24372A;
          --fu-green: #315B40;
          --fu-green-light: #EAF0E5;
          --fu-cream: #F8F5EC;
          --fu-paper: #FFFCF5;
          --fu-muted: #77796D;
          --fu-border: #E8E3D7;
          --fu-orange: #C56A43;
          --fu-yellow: #E7C982;
          color: var(--fu-ink);
          padding-bottom: 44px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .food-universe :global(*) {
          box-sizing: border-box;
        }

        .universe-hero {
          min-height: 350px;
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: 1.1fr .9fr;
          border-radius: 24px;
          background: var(--fu-cream);
          border: 1px solid #EEE7D9;
          margin-bottom: 27px;
          isolation: isolate;
        }

        .universe-hero-content {
          padding: 38px 0 28px 40px;
          position: relative;
          z-index: 2;
        }

        .universe-eyebrow {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .15em;
          color: #81816F;
        }

        .universe-hero-eyebrow {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 21px;
        }

        .universe-eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #78936C;
          box-shadow: 0 0 0 4px rgba(120, 147, 108, .12);
        }

        .universe-hero h1 {
          font-family: Georgia, 'Times New Roman', serif;
          font-weight: 500;
          font-size: clamp(34px, 3.1vw, 49px);
          letter-spacing: -.055em;
          line-height: 1.07;
          margin: 0;
          color: #293B2D;
        }

        .universe-hero h1 span {
          font-style: italic;
          color: #B96844;
        }

        .universe-hero-description {
          max-width: 365px;
          margin-top: 16px;
          color: #707568;
          font-size: 13px;
          line-height: 1.8;
        }

        .universe-hero-actions {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          margin-top: 22px;
        }

        .universe-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border-radius: 10px;
          padding: 11px 16px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          transition: transform .2s ease, background .2s ease, box-shadow .2s ease;
        }

        .universe-button:hover {
          transform: translateY(-2px);
        }

        .universe-button-dark {
          background: #2D4935;
          color: #FFFDF7;
          box-shadow: 0 5px 14px rgba(45, 73, 53, .15);
        }

        .universe-button-dark:hover {
          background: #1F3827;
          box-shadow: 0 8px 20px rgba(45, 73, 53, .2);
        }

        .universe-button-plus {
          font-size: 17px;
          line-height: 1;
          font-weight: 400;
        }

        .universe-text-link {
          color: #4C624C;
          font-size: 11px;
          font-weight: 700;
          text-decoration: none;
        }

        .universe-text-link span {
          padding-left: 4px;
        }

        .universe-hero-footnote {
          margin-top: 25px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #8C8A7C;
          font-size: 10px;
          font-weight: 600;
        }

        .universe-sun {
          color: #B96844;
          font-size: 15px;
        }

        .universe-hero-art {
          position: relative;
          min-height: 350px;
          overflow: hidden;
          display: grid;
          place-items: center;
          perspective: 900px;
        }

        .universe-art-orbit {
          position: absolute;
          border: 1px solid rgba(93, 111, 77, .13);
          border-radius: 50%;
          transform: rotate(-24deg);
        }

        .universe-art-orbit-one {
          width: 325px;
          height: 230px;
        }

        .universe-art-orbit-two {
          width: 270px;
          height: 340px;
          transform: rotate(34deg);
        }

        .universe-art-label {
          position: absolute;
          top: 28px;
          right: 31px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          color: #8C907B;
          font-size: 8px;
          letter-spacing: .16em;
          font-weight: 800;
        }

        .universe-plate {
          position: relative;
          z-index: 1;
          width: clamp(175px, 19vw, 225px);
          aspect-ratio: 1;
          border-radius: 50%;
          background: linear-gradient(135deg, #FFFEF8 5%, #EDE7D9 100%);
          padding: 13px;
          box-shadow:
            0 24px 36px rgba(73, 67, 42, .16),
            0 4px 7px rgba(73, 67, 42, .1),
            inset 0 2px 4px rgba(255, 255, 255, .95);
          transform: rotate(-9deg);
          animation: plateFloat 6s ease-in-out infinite;
        }

        .universe-plate-inner {
          width: 100%;
          height: 100%;
          border: 1px solid #D9D1BE;
          border-radius: 50%;
          background: #F9F4E6;
          position: relative;
          overflow: hidden;
        }

        .universe-food-food {
          position: absolute;
          box-shadow: inset 0 1px 3px rgba(49, 35, 17, .12);
        }

        .rice {
          width: 43%;
          height: 48%;
          left: 10%;
          top: 12%;
          border-radius: 54% 45% 50% 42%;
          background: #F0E1B6;
          transform: rotate(-17deg);
        }

        .rice span {
          position: absolute;
          width: 18%;
          height: 6%;
          border-radius: 50%;
          background: #FFFAE9;
        }

        .rice span:nth-child(1) { top: 24%; left: 14%; transform: rotate(25deg); }
        .rice span:nth-child(2) { top: 43%; left: 49%; transform: rotate(-35deg); }
        .rice span:nth-child(3) { top: 64%; left: 25%; transform: rotate(17deg); }
        .rice span:nth-child(4) { top: 30%; left: 66%; transform: rotate(45deg); }
        .rice span:nth-child(5) { top: 76%; left: 65%; transform: rotate(-25deg); }

        .greens {
          width: 36%;
          height: 34%;
          right: 11%;
          top: 12%;
          border-radius: 52% 48% 43% 55%;
          background: #477D4C;
          transform: rotate(15deg);
        }

        .greens span {
          position: absolute;
          width: 46%;
          height: 28%;
          background: #709A57;
          border-radius: 100% 0 100% 0;
        }

        .greens span:nth-child(1) { top: 13%; left: 9%; transform: rotate(-25deg); }
        .greens span:nth-child(2) { top: 24%; right: 8%; transform: rotate(55deg); }
        .greens span:nth-child(3) { bottom: 8%; left: 25%; transform: rotate(35deg); }
        .greens span:nth-child(4) { bottom: 19%; right: 8%; transform: rotate(70deg); }

        .tomato {
          width: 27%;
          height: 25%;
          left: 12%;
          bottom: 12%;
          background: #CE5C42;
          border-radius: 50%;
          transform: rotate(20deg);
        }

        .tomato span {
          position: absolute;
          width: 40%;
          height: 40%;
          top: 30%;
          left: 30%;
          background: #EAA27A;
          border-radius: 50%;
        }

        .curry {
          width: 31%;
          height: 32%;
          right: 12%;
          bottom: 11%;
          border-radius: 48%;
          background: #D9A94E;
          transform: rotate(-12deg);
        }

        .curry span {
          position: absolute;
          width: 25%;
          height: 25%;
          border-radius: 50%;
          background: #F1D18A;
        }

        .curry span:nth-child(1) { top: 20%; left: 23%; }
        .curry span:nth-child(2) { bottom: 19%; right: 20%; }

        .roti {
          width: 21%;
          height: 19%;
          left: 40%;
          top: 39%;
          border-radius: 50%;
          background: #D6B178;
          border: 4px solid #E9D3A4;
          transform: rotate(15deg);
        }

        .universe-floating-note {
          position: absolute;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 10px 12px;
          border: 1px solid rgba(255, 255, 255, .9);
          border-radius: 12px;
          background: rgba(255, 253, 246, .92);
          box-shadow: 0 10px 28px rgba(65, 67, 43, .1);
          backdrop-filter: blur(8px);
          animation: noteFloat 5s ease-in-out infinite;
        }

        .universe-note-top {
          top: 83px;
          left: 0;
        }

        .universe-note-bottom {
          bottom: 57px;
          right: 5px;
          animation-delay: -2.5s;
        }

        .universe-note-icon {
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #E8EFE1;
          color: #426B43;
          font-size: 16px;
        }

        .note-orange {
          background: #F8E7D9;
          color: #B96844;
        }

        .universe-floating-note strong,
        .universe-floating-note small {
          display: block;
        }

        .universe-floating-note strong {
          font-size: 10px;
          color: #344535;
        }

        .universe-floating-note small {
          margin-top: 2px;
          font-size: 9px;
          color: #8A8B7E;
        }

        .universe-art-spark {
          position: absolute;
          color: #C58A4C;
        }

        .universe-spark-one {
          top: 77px;
          right: 67px;
          font-size: 23px;
        }

        .universe-spark-two {
          left: 30px;
          bottom: 72px;
          font-size: 17px;
        }

        .universe-dayline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 0 2px 27px;
        }

        .universe-dayline > div {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .universe-day-icon {
          font-size: 20px;
          color: #B96844;
        }

        .universe-day-label {
          color: #697262;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .13em;
        }

        .universe-current-date {
          color: #858577;
          font-size: 11px;
        }

        .universe-notice {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px 17px;
          margin-bottom: 25px;
          border: 1px solid #EBD8B6;
          border-radius: 13px;
          background: #FFF7E8;
        }

        .universe-notice-icon {
          flex: 0 0 23px;
          width: 23px;
          height: 23px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #E8C780;
          color: #654A1D;
          font-weight: 800;
          font-size: 12px;
        }

        .universe-notice strong {
          display: block;
          color: #765624;
          font-size: 12px;
        }

        .universe-notice p {
          margin-top: 4px;
          color: #8A7149;
          font-size: 11px;
          line-height: 1.7;
        }

        .universe-notice-link {
          flex-shrink: 0;
          margin-left: auto;
          color: #8D6027;
          font-size: 11px;
          font-weight: 700;
          text-decoration: none;
        }

        .universe-section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          margin: 33px 0 17px;
        }

        .universe-section-heading .universe-eyebrow {
          margin-bottom: 8px;
        }

        .universe-section-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-weight: 500;
          font-size: clamp(24px, 2.3vw, 31px);
          letter-spacing: -.045em;
          line-height: 1.15;
          color: #293B2D;
          margin: 0;
        }

        .universe-section-description {
          margin-top: 7px;
          font-size: 11.5px;
          color: #818174;
          line-height: 1.6;
        }

        .universe-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .universe-metric {
          position: relative;
          min-width: 0;
          padding: 20px;
          border: 1px solid var(--fu-border);
          border-radius: 17px;
          background: var(--fu-paper);
          transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
          box-shadow: 0 2px 5px rgba(56, 52, 37, .025);
        }

        .universe-metric:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 26px rgba(56, 52, 37, .07);
          border-color: #D8D9C8;
        }

        .universe-metric-primary {
          background: linear-gradient(145deg, #F8F7EC, #FFFCF5);
        }

        .universe-metric-protein {
          background: linear-gradient(145deg, #F9F0E6, #FFFCF5);
        }

        .universe-metric-spending {
          background: linear-gradient(145deg, #F8EEE7, #FFFCF5);
        }

        .universe-metric-meals {
          background: linear-gradient(145deg, #EEF1E7, #FFFCF5);
        }

        .universe-metric-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }

        .universe-metric-label {
          color: #7C8071;
          font-size: 9px;
          letter-spacing: .12em;
          font-weight: 800;
        }

        .universe-metric-icon {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(49, 91, 64, .09);
          color: #426446;
          font-size: 15px;
          font-weight: 700;
        }

        .universe-metric-protein .universe-metric-icon,
        .universe-metric-spending .universe-metric-icon {
          color: #B96844;
          background: rgba(197, 106, 67, .1);
        }

        .universe-metric-meals .universe-metric-icon {
          color: #6A7957;
          background: rgba(106, 121, 87, .12);
        }

        .universe-metric-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .universe-metric-number {
          font-size: clamp(27px, 3vw, 38px);
          font-weight: 800;
          letter-spacing: -.06em;
          line-height: 1.1;
          color: #293B2D;
          font-variant-numeric: tabular-nums;
          overflow-wrap: anywhere;
        }

        .universe-metric-number > span {
          margin-left: 5px;
          color: #858778;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0;
        }

        .universe-metric-support {
          margin-top: 7px;
          color: #858577;
          font-size: 10.5px;
          line-height: 1.5;
        }

        .universe-ring {
          flex-shrink: 0;
          width: 78px;
          height: 78px;
        }

        .universe-ring-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .universe-ring-progress {
          transition: stroke-dashoffset .8s cubic-bezier(.16, 1, .3, 1);
        }

        .universe-ring-text {
          fill: #334534;
          font-size: 16px;
          font-weight: 800;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .universe-meter {
          width: 100%;
          height: 5px;
          margin-top: 17px;
          border-radius: 20px;
          background: #E9E5D9;
          overflow: hidden;
        }

        .universe-meter-fill {
          height: 100%;
          border-radius: inherit;
          transition: width .6s ease;
        }

        .universe-metric-bottom {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-top: 9px;
          color: #858577;
          font-size: 9px;
        }

        .universe-metric-bottom strong {
          color: #56634F;
          font-size: 9px;
          text-align: right;
        }

        .universe-budget-divider {
          margin: 17px 0 12px;
          border-top: 1px dashed #E3D8CB;
        }

        .universe-budget-row {
          display: flex;
          justify-content: space-between;
          color: #858577;
          font-size: 10px;
        }

        .universe-budget-row strong {
          color: #B96844;
        }

        .universe-meal-status {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 20px;
          color: #68775D;
          font-size: 10px;
        }

        .universe-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #799768;
        }

        .universe-meal-link {
          display: flex;
          justify-content: space-between;
          margin-top: 15px;
          padding-top: 12px;
          border-top: 1px solid #E2E6D9;
          color: #426447;
          font-size: 10px;
          font-weight: 800;
          text-decoration: none;
        }

        .universe-charts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .universe-panel {
          min-width: 0;
          padding: 21px;
          border: 1px solid var(--fu-border);
          border-radius: 17px;
          background: var(--fu-paper);
          box-shadow: 0 3px 10px rgba(56, 52, 37, .025);
        }

        .universe-panel-spending {
          background: linear-gradient(145deg, #FFFAF3, #FFFCF5);
        }

        .universe-panel-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 20px;
        }

        .universe-panel-kicker {
          color: #8B8A79;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .12em;
        }

        .universe-panel-heading h3 {
          margin: 8px 0 5px;
          color: #293B2D;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -.035em;
        }

        .universe-panel-heading p {
          color: #858577;
          font-size: 10.5px;
          line-height: 1.6;
        }

        .universe-panel-decoration {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          border-radius: 11px;
          background: #EDF0E5;
          color: #52734C;
          font-size: 17px;
        }

        .universe-panel-spending .universe-panel-decoration {
          background: #F8E8DC;
          color: #BC704C;
        }

        .universe-chart {
          position: relative;
          height: 245px;
          min-width: 0;
        }

        .universe-empty-chart {
          height: 100%;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          border-radius: 12px;
          background: #F8F6ED;
        }

        .universe-empty-symbol {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          margin-bottom: 13px;
          background: #E9EEDF;
          color: #55744C;
          font-family: Georgia, serif;
          font-size: 23px;
        }

        .universe-empty-chart strong {
          color: #465441;
          font-size: 11px;
        }

        .universe-empty-chart p {
          max-width: 230px;
          margin-top: 7px;
          color: #858577;
          font-size: 10px;
          line-height: 1.7;
        }

        .universe-inline-link {
          margin-top: 12px;
          color: #426447;
          font-size: 10px;
          font-weight: 800;
          text-decoration: none;
        }

        .universe-chart-footer {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          margin-top: 14px;
          padding-top: 13px;
          border-top: 1px solid #ECE7DA;
          color: #858577;
          font-size: 9px;
        }

        .universe-chart-footer strong {
          color: #465441;
          font-size: 10px;
        }

        .universe-chart-footer-separator {
          padding: 0 3px;
          color: #C1B9A7;
        }

        .universe-journal-section {
          margin-top: 37px;
        }

        .universe-button-outline {
          border: 1px solid #DADFD1;
          background: #FFFCF5;
          color: #426447;
        }

        .universe-button-outline:hover {
          background: #EDF1E7;
        }

        .universe-journal {
          overflow: hidden;
          border: 1px solid var(--fu-border);
          border-radius: 17px;
          background: var(--fu-paper);
          box-shadow: 0 3px 10px rgba(56, 52, 37, .025);
        }

        .universe-journal-header,
        .universe-journal-row {
          display: grid;
          grid-template-columns: minmax(155px, 1.7fr) .55fr .7fr 1.1fr .7fr .6fr;
          align-items: center;
          gap: 12px;
          padding: 14px 17px;
        }

        .universe-journal-header {
          background: #F3F1E7;
          border-bottom: 1px solid #E8E3D7;
          color: #828373;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .09em;
        }

        .universe-journal-row {
          min-height: 82px;
          border-bottom: 1px solid #EEE9DE;
          transition: background .18s ease;
        }

        .universe-journal-row:last-child {
          border-bottom: 0;
        }

        .universe-journal-row:hover {
          background: #FAF8F0;
        }

        .universe-food-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .universe-food-avatar {
          display: grid;
          place-items: center;
          flex: 0 0 37px;
          width: 37px;
          height: 37px;
          border-radius: 12px;
          background: #E8EDDF;
          color: #436245;
          font-family: Georgia, serif;
          font-size: 17px;
          text-transform: uppercase;
        }

        .universe-journal-row:nth-child(odd) .universe-food-avatar {
          background: #F7E7D9;
          color: #B96844;
        }

        .universe-food-details {
          min-width: 0;
        }

        .universe-food-details strong,
        .universe-food-details > span {
          display: block;
          overflow-wrap: anywhere;
        }

        .universe-food-details strong {
          color: #354332;
          font-size: 10px;
          line-height: 1.5;
        }

        .universe-food-details > span {
          margin-top: 3px;
          color: #898879;
          font-size: 9px;
          line-height: 1.5;
        }

        .universe-camera-tag {
          display: inline-block;
          margin-left: 5px;
          padding: 2px 4px;
          border-radius: 4px;
          background: #E8EDE0;
          color: #52714D;
          font-size: 7px;
          font-weight: 800;
        }

        .universe-journal-quantity {
          color: #62695B;
          font-size: 10px;
        }

        .universe-journal-price {
          color: #39553B;
          font-size: 11px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .universe-journal-nutrition strong,
        .universe-journal-nutrition > span {
          display: block;
        }

        .universe-journal-nutrition strong {
          color: #485441;
          font-size: 10px;
        }

        .universe-journal-nutrition > span:not(.universe-nutrition-tag) {
          margin-top: 3px;
          color: #898879;
          font-size: 8px;
        }

        .universe-nutrition-tag {
          display: inline-block;
          margin-top: 5px;
          padding: 3px 6px;
          border-radius: 5px;
          font-size: 8px;
          font-weight: 700;
        }

        .universe-nutrition-tag.is-complete {
          background: #E9F0E4;
          color: #426B43;
        }

        .universe-nutrition-tag.is-incomplete {
          background: #FFF0D8;
          color: #936A2C;
        }

        .universe-journal-time strong,
        .universe-journal-time span {
          display: block;
        }

        .universe-journal-time strong {
          color: #58614F;
          font-size: 10px;
        }

        .universe-journal-time span {
          margin-top: 4px;
          color: #929080;
          font-size: 9px;
        }

        .universe-delete-button {
          border: 1px solid #E8DAD2;
          border-radius: 7px;
          padding: 6px 8px;
          background: transparent;
          color: #A35A43;
          font-family: inherit;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
          transition: background .2s ease;
        }

        .universe-delete-button:hover:not(:disabled) {
          background: #F9E9E1;
        }

        .universe-delete-button:disabled {
          opacity: .55;
          cursor: wait;
        }

        .universe-journal-empty {
          padding: 45px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .universe-journal-empty-art {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          margin-bottom: 16px;
          border-radius: 18px;
          background: #EDF1E7;
          color: #58764D;
          font-size: 25px;
        }

        .universe-journal-empty h3 {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 23px;
          font-weight: 500;
          color: #334331;
        }

        .universe-journal-empty p {
          max-width: 370px;
          margin: 9px 0 19px;
          color: #858577;
          font-size: 11px;
          line-height: 1.8;
        }

        .universe-discover {
          display: grid;
          grid-template-columns: .85fr 1.15fr;
          gap: 30px;
          margin-top: 28px;
          padding: 27px;
          border: 1px solid #E6E4D6;
          border-radius: 19px;
          background: #F0F0E5;
        }

        .universe-discover-copy h2 {
          margin-top: 11px;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(22px, 2vw, 29px);
          line-height: 1.18;
          letter-spacing: -.04em;
          font-weight: 500;
          color: #30402F;
        }

        .universe-discover-copy p {
          max-width: 310px;
          margin-top: 10px;
          color: #777A6B;
          font-size: 11px;
          line-height: 1.8;
        }

        .universe-discover-links {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .universe-discover-link {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding: 11px 12px;
          border: 1px solid rgba(220, 222, 207, .9);
          border-radius: 11px;
          background: rgba(255, 253, 246, .72);
          text-decoration: none;
          transition: transform .18s ease, background .18s ease;
        }

        .universe-discover-link:hover {
          transform: translateX(3px);
          background: #FFFCF5;
        }

        .universe-discover-icon {
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #E7EDE0;
          color: #456646;
          font-size: 16px;
        }

        .universe-discover-icon.orange {
          background: #F8E7D9;
          color: #B96844;
        }

        .universe-discover-icon.yellow {
          background: #F5EDCE;
          color: #8B7137;
        }

        .universe-discover-link > span:nth-child(2) {
          flex: 1;
          min-width: 0;
        }

        .universe-discover-link strong,
        .universe-discover-link small {
          display: block;
        }

        .universe-discover-link strong {
          color: #3D4B38;
          font-size: 10px;
        }

        .universe-discover-link small {
          margin-top: 3px;
          color: #858577;
          font-size: 9px;
        }

        .universe-discover-arrow {
          color: #718067;
          font-size: 15px;
        }

        .universe-toast {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: calc(100vw - 32px);
          padding: 14px 18px;
          border: 1px solid #D8E5D2;
          border-radius: 12px;
          background: #F5FAF0;
          color: #355638;
          box-shadow: 0 12px 30px rgba(38, 57, 37, .14);
          font-size: 12px;
          font-weight: 700;
          animation: toastIn .25s ease-out;
        }

        .universe-toast.is-error {
          border-color: #F0D2C8;
          background: #FFF2ED;
          color: #9C422E;
        }

        .universe-toast-dot {
          width: 8px;
          height: 8px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #719365;
        }

        .universe-toast.is-error .universe-toast-dot {
          background: #C65D45;
        }

        @keyframes plateFloat {
          0%, 100% { transform: translateY(0) rotate(-9deg); }
          50% { transform: translateY(-7px) rotate(-6deg); }
        }

        @keyframes noteFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (min-width: 1450px) {
          .universe-hero-content {
            padding-left: 48px;
          }
          .universe-metric {
            padding: 24px;
          }
        }

        @media (max-width: 1150px) {
          .universe-hero-content {
            padding-left: 27px;
          }
          .universe-hero h1 {
            font-size: 38px;
          }
          .universe-hero-art {
            transform: scale(.92);
          }
          .universe-journal-header,
          .universe-journal-row {
            grid-template-columns: minmax(135px, 1.5fr) .45fr .6fr 1fr .55fr .55fr;
            gap: 8px;
            padding-left: 12px;
            padding-right: 12px;
          }
        }

        @media (max-width: 850px) {
          .universe-hero {
            grid-template-columns: 1fr .8fr;
          }
          .universe-hero-content {
            padding: 30px 0 25px 25px;
          }
          .universe-hero h1 {
            font-size: 34px;
          }
          .universe-hero-art {
            min-height: 310px;
            transform: scale(.86);
          }
          .universe-note-top {
            left: -8px;
          }
          .universe-metrics {
            gap: 12px;
          }
          .universe-metric {
            padding: 17px;
          }
          .universe-charts {
            gap: 12px;
          }
          .universe-panel {
            padding: 16px;
          }
          .universe-journal {
            overflow-x: auto;
          }
          .universe-journal-header,
          .universe-journal-row {
            min-width: 760px;
          }
          .universe-discover {
            gap: 18px;
            padding: 21px;
          }
        }

        @media (max-width: 600px) {
          .food-universe {
            padding-bottom: 25px;
          }
          .universe-hero {
            grid-template-columns: 1fr;
            border-radius: 19px;
          }
          .universe-hero-content {
            padding: 26px 22px 0;
          }
          .universe-hero h1 {
            font-size: 39px;
          }
          .universe-hero-description {
            max-width: 100%;
          }
          .universe-hero-actions {
            gap: 14px;
            margin-top: 18px;
          }
          .universe-hero-footnote {
            margin-top: 18px;
          }
          .universe-hero-art {
            min-height: 255px;
            margin-top: -2px;
            transform: none;
          }
          .universe-plate {
            width: 170px;
          }
          .universe-art-orbit-one {
            width: 255px;
            height: 190px;
          }
          .universe-art-orbit-two {
            width: 210px;
            height: 270px;
          }
          .universe-note-top {
            top: 42px;
            left: 3px;
          }
          .universe-note-bottom {
            right: 0;
            bottom: 27px;
          }
          .universe-floating-note {
            padding: 8px 9px;
          }
          .universe-floating-note strong {
            font-size: 9px;
          }
          .universe-floating-note small {
            font-size: 8px;
          }
          .universe-art-label {
            top: 14px;
            right: 14px;
          }
          .universe-dayline {
            align-items: flex-start;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 23px;
          }
          .universe-current-date {
            padding-left: 29px;
          }
          .universe-section-heading {
            align-items: flex-start;
            margin-top: 29px;
          }
          .universe-section-title {
            font-size: 27px;
          }
          .universe-metrics {
            grid-template-columns: 1fr;
          }
          .universe-metric {
            padding: 20px;
          }
          .universe-metric-number {
            font-size: 36px;
          }
          .universe-ring {
            width: 76px;
            height: 76px;
          }
          .universe-charts {
            grid-template-columns: 1fr;
          }
          .universe-panel {
            padding: 18px;
          }
          .universe-chart {
            height: 235px;
          }
          .universe-notice {
            flex-wrap: wrap;
          }
          .universe-notice-link {
            margin-left: 35px;
          }
          .universe-journal-section .universe-section-heading {
            align-items: flex-end;
          }
          .universe-journal-section .universe-section-description {
            max-width: 280px;
          }
          .universe-journal-section .universe-button {
            flex-shrink: 0;
            padding: 10px;
            font-size: 10px;
          }
          .universe-discover {
            grid-template-columns: 1fr;
            padding: 22px;
            gap: 19px;
          }
          .universe-discover-copy h2 {
            max-width: 350px;
          }
          .universe-toast {
            right: 12px;
            bottom: 12px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .food-universe *,
          .food-universe *::before,
          .food-universe *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
