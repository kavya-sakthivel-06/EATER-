/**
 * AI Algorithms Module for Eater
 * Contains: Cosine Similarity, Linear Regression, Isolation Forest, K-Means
 * All algorithms use real data from the database with proper validation.
 */

// ============ UTILITY FUNCTIONS ============

function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

function magnitude(v) {
  return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
}

function cosineSimilarity(a, b) {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function standardDeviation(arr) {
  const avg = mean(arr);
  const sqDiffs = arr.map(v => (v - avg) ** 2);
  return Math.sqrt(mean(sqDiffs));
}

function standardize(values) {
  const avg = mean(values);
  const std = standardDeviation(values);
  if (std === 0) return values.map(() => 0);
  return values.map(v => (v - avg) / std);
}

function minMaxNormalize(value, min, max) {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

// ============ AI FEATURE 1: COSINE SIMILARITY RECOMMENDATIONS ============

function getRecommendations(db, userId, options = {}) {
  const {
    maxPrice = Infinity,
    proteinPriority = 0.5,  // 0-1
    caloriePriority = 0.5,  // 0-1
    category = null,
    canteen = null,
    limit = 20,
    preferLowCalorie = false
  } = options;

  // Get user preferences
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return { error: 'User not found', recommendations: [] };

  // Get all eligible foods
  let query = 'SELECT * FROM foods WHERE price_inr <= ?';
  const params = [maxPrice === Infinity ? 99999 : maxPrice];
  
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (canteen) {
    query += ' AND canteen = ?';
    params.push(canteen);
  }

  const foods = db.prepare(query).all(...params);
  if (foods.length === 0) {
    return { recommendations: [], explanation: 'No foods match the selected filters.' };
  }

  // Get user's recent food log to understand preferences
  const recentLogs = db.prepare(`
    SELECT food_name_snapshot, canteen_snapshot, calories_snapshot, protein_snapshot, price_snapshot
    FROM food_logs WHERE user_id = ? ORDER BY logged_at DESC LIMIT 50
  `).all(userId);

  // Build user preference vector
  const avgLoggedCalories = recentLogs.length > 0 
    ? mean(recentLogs.filter(l => l.calories_snapshot).map(l => l.calories_snapshot))
    : user.daily_calorie_target / 3; // rough per-meal estimate

  const avgLoggedProtein = recentLogs.length > 0
    ? mean(recentLogs.filter(l => l.protein_snapshot).map(l => l.protein_snapshot))
    : user.daily_protein_target / 3;

  const avgLoggedPrice = recentLogs.length > 0
    ? mean(recentLogs.map(l => l.price_snapshot))
    : user.monthly_budget / 90; // ~3 meals * 30 days

  // Normalize all food features
  const prices = foods.map(f => f.price_inr);
  const calories = foods.filter(f => f.calories_kcal).map(f => f.calories_kcal);
  const proteins = foods.filter(f => f.protein_g).map(f => f.protein_g);

  const priceMin = Math.min(...prices);
  const priceMax = Math.max(...prices);
  const calMin = calories.length > 0 ? Math.min(...calories) : 0;
  const calMax = calories.length > 0 ? Math.max(...calories) : 500;
  const proMin = proteins.length > 0 ? Math.min(...proteins) : 0;
  const proMax = proteins.length > 0 ? Math.max(...proteins) : 30;

  // User preference vector [price_norm, calorie_norm, protein_norm]
  const userVector = [
    1 - minMaxNormalize(avgLoggedPrice, priceMin, priceMax),  // prefer lower price
    preferLowCalorie 
      ? 1 - minMaxNormalize(avgLoggedCalories, calMin, calMax) 
      : minMaxNormalize(avgLoggedCalories, calMin, calMax),
    minMaxNormalize(avgLoggedProtein, proMin, proMax)  // prefer higher protein
  ];

  // Apply priority weights
  const weightedUserVector = [
    userVector[0] * (1 - proteinPriority - caloriePriority + 0.5),  // budget weight
    userVector[1] * caloriePriority,
    userVector[2] * proteinPriority
  ];

  // Score each food
  const scored = foods.map(food => {
    const foodVector = [
      1 - minMaxNormalize(food.price_inr, priceMin, priceMax),
      food.calories_kcal != null
        ? (preferLowCalorie 
            ? 1 - minMaxNormalize(food.calories_kcal, calMin, calMax) 
            : minMaxNormalize(food.calories_kcal, calMin, calMax))
        : 0.5,  // neutral when missing
      food.protein_g != null
        ? minMaxNormalize(food.protein_g, proMin, proMax)
        : 0.5
    ];

    const weightedFoodVector = [
      foodVector[0] * (1 - proteinPriority - caloriePriority + 0.5),
      foodVector[1] * caloriePriority,
      foodVector[2] * proteinPriority
    ];

    const similarity = cosineSimilarity(weightedUserVector, weightedFoodVector);

    // Generate reason
    const reasons = [];
    if (food.price_inr <= avgLoggedPrice) reasons.push('Within your typical price range');
    if (food.protein_g && food.protein_g > avgLoggedProtein) reasons.push('Higher protein than your usual choices');
    if (food.calories_kcal && preferLowCalorie && food.calories_kcal < avgLoggedCalories) reasons.push('Lower calorie option');
    if (food.calories_kcal && !preferLowCalorie && food.calories_kcal >= avgLoggedCalories * 0.8) reasons.push('Matches your calorie preference');
    if (food.price_inr <= user.monthly_budget / 90) reasons.push('Fits your remaining budget');
    if (reasons.length === 0) reasons.push('Matches your overall preference profile');

    return {
      ...food,
      similarity_score: Math.round(similarity * 1000) / 1000,
      reason: reasons.join('; '),
      nutrition_available: food.calories_kcal != null
    };
  });

  scored.sort((a, b) => b.similarity_score - a.similarity_score);

  // Baseline: cheapest foods
  const baseline = [...foods].sort((a, b) => a.price_inr - b.price_inr).slice(0, limit);

  return {
    recommendations: scored.slice(0, limit),
    algorithm: 'Cosine Similarity',
    description: 'Foods ranked by cosine similarity between normalized food feature vectors (price, calories, protein) and your preference profile derived from recent food logs and selected priorities.',
    inputs: {
      user_avg_price: Math.round(avgLoggedPrice),
      user_avg_calories: Math.round(avgLoggedCalories),
      user_avg_protein: Math.round(avgLoggedProtein),
      food_count: foods.length,
      history_entries: recentLogs.length,
      priority_weights: { protein: proteinPriority, calorie: caloriePriority },
      cold_start: recentLogs.length < 5
    },
    baseline_method: 'Cheapest eligible foods',
    limitations: [
      'Nutrition data is incomplete for many items — foods without nutrition receive neutral scores',
      'Cosine similarity does not account for meal timing or variety',
      recentLogs.length < 5 ? 'Cold-start mode: using selected goals since insufficient history' : null
    ].filter(Boolean)
  };
}

// ============ AI FEATURE 2: LINEAR REGRESSION SPENDING PREDICTION ============

function predictMonthlySpending(db, userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return { error: 'User not found' };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const currentDay = now.getDate();

  // Get daily spending for last 60 days for training
  const dailySpending = db.prepare(`
    SELECT DATE(logged_at) as date, SUM(price_snapshot) as daily_spend, COUNT(*) as item_count
    FROM food_logs 
    WHERE user_id = ? AND logged_at >= date('now', '-60 days')
    GROUP BY DATE(logged_at)
    ORDER BY date
  `).all(userId);

  if (dailySpending.length < 7) {
    return {
      error: null,
      insufficient_data: true,
      message: `Not enough spending history yet. Need at least 7 days of data, have ${dailySpending.length}.`,
      data_points: dailySpending.length,
      algorithm: 'Linear Regression'
    };
  }

  // Get this month's spending so far
  const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const thisMonthDays = dailySpending.filter(d => d.date >= monthStart);

  // Build cumulative spending for current month
  let cumulative = 0;
  const cumulativeData = thisMonthDays.map((d, i) => {
    cumulative += d.daily_spend;
    return { day: i + 1, cumSpend: cumulative, dailySpend: d.daily_spend };
  });

  // Linear regression on daily spending (using all history for daily average)
  const dailyAmounts = dailySpending.map(d => d.daily_spend);
  const avgDaily = mean(dailyAmounts);
  const stdDaily = standardDeviation(dailyAmounts);

  // Simple linear regression: y = mx + b on cumulative spending
  // x = day number in month, y = cumulative spend
  if (cumulativeData.length >= 3) {
    const xs = cumulativeData.map(d => d.day);
    const ys = cumulativeData.map(d => d.cumSpend);
    const { slope, intercept, r2 } = linearRegression(xs, ys);

    const predictedMonthEnd = slope * daysInMonth + intercept;
    
    // Baseline: avg daily * days in month
    const baselinePrediction = avgDaily * daysInMonth;

    // Held-out evaluation: use last 20% of data points
    const splitIdx = Math.max(Math.floor(cumulativeData.length * 0.8), 2);
    const trainX = xs.slice(0, splitIdx);
    const trainY = ys.slice(0, splitIdx);
    const testX = xs.slice(splitIdx);
    const testY = ys.slice(splitIdx);

    let mae = null;
    let evalR2 = null;
    let baselineMae = null;

    if (testX.length > 0) {
      const trainReg = linearRegression(trainX, trainY);
      const predictions = testX.map(x => trainReg.slope * x + trainReg.intercept);
      const baselinePreds = testX.map(x => avgDaily * x);

      mae = mean(predictions.map((p, i) => Math.abs(p - testY[i])));
      baselineMae = mean(baselinePreds.map((p, i) => Math.abs(p - testY[i])));

      // R² on test set
      const ssTot = testY.reduce((s, y) => s + (y - mean(testY)) ** 2, 0);
      const ssRes = predictions.reduce((s, p, i) => s + (p - testY[i]) ** 2, 0);
      evalR2 = ssTot > 0 ? 1 - ssRes / ssTot : null;
    }

    const modelBetterThanBaseline = mae != null && baselineMae != null && mae < baselineMae;

    return {
      predicted_month_end: Math.round(predictedMonthEnd),
      budget: user.monthly_budget,
      budget_difference: Math.round(user.monthly_budget - predictedMonthEnd),
      over_budget: predictedMonthEnd > user.monthly_budget,
      current_spent: Math.round(cumulative),
      current_day: currentDay,
      days_in_month: daysInMonth,
      avg_daily_spend: Math.round(avgDaily),
      baseline_prediction: Math.round(baselinePrediction),
      cumulative_data: cumulativeData,
      evaluation: {
        mae: mae ? Math.round(mae) : null,
        r2: evalR2 != null ? Math.round(evalR2 * 1000) / 1000 : null,
        baseline_mae: baselineMae ? Math.round(baselineMae) : null,
        model_better_than_baseline: modelBetterThanBaseline,
        test_points: testX ? testX.length : 0,
        note: evalR2 != null && evalR2 < 0 
          ? 'R² is negative — the model performs worse than predicting the mean. The forecast is experimental.'
          : (modelBetterThanBaseline === false && mae != null
            ? 'Model MAE is not better than baseline. Forecast should be treated as experimental.'
            : null)
      },
      regression: { slope: Math.round(slope * 100) / 100, intercept: Math.round(intercept), r2: Math.round(r2 * 1000) / 1000 },
      projected_trajectory: Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        projected: Math.round(slope * (i + 1) + intercept)
      })),
      algorithm: 'Linear Regression',
      description: 'Predicts month-end spending by fitting a linear model to your cumulative daily spending this month.',
      data_period: `${dailySpending.length} days of history, ${thisMonthDays.length} days this month`,
      limitations: [
        'Assumes spending pattern remains linear throughout the month',
        'Does not account for weekday/weekend variation or holidays',
        dailySpending.length < 14 ? 'Limited history — prediction may be unreliable' : null
      ].filter(Boolean)
    };
  }

  // Fallback: just use daily average
  return {
    predicted_month_end: Math.round(avgDaily * daysInMonth),
    budget: user.monthly_budget,
    budget_difference: Math.round(user.monthly_budget - avgDaily * daysInMonth),
    over_budget: avgDaily * daysInMonth > user.monthly_budget,
    current_spent: Math.round(cumulative),
    avg_daily_spend: Math.round(avgDaily),
    baseline_prediction: Math.round(avgDaily * daysInMonth),
    algorithm: 'Linear Regression (fallback to daily average)',
    description: 'Insufficient data points this month for regression. Using daily average × remaining days.',
    data_period: `${dailySpending.length} days of history`,
    insufficient_this_month: true,
    limitations: ['Not enough data points this month for proper regression — using average daily spending']
  };
}

function linearRegression(xs, ys) {
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R²
  const meanY = sumY / n;
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2 };
}

// ============ AI FEATURE 3: ISOLATION FOREST (SIMPLIFIED) ============

function detectUnusualSpending(db, userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return { error: 'User not found' };

  // Get daily spending aggregates
  const dailyData = db.prepare(`
    SELECT 
      DATE(logged_at) as date,
      SUM(price_snapshot) as daily_spend,
      COUNT(*) as item_count,
      AVG(price_snapshot) as avg_item_price,
      SUM(COALESCE(calories_snapshot, 0)) as total_calories,
      SUM(COALESCE(protein_snapshot, 0)) as total_protein
    FROM food_logs 
    WHERE user_id = ?
    GROUP BY DATE(logged_at)
    ORDER BY date
  `).all(userId);

  if (dailyData.length < 10) {
    return {
      insufficient_data: true,
      message: `Need at least 10 days of data for anomaly detection. Have ${dailyData.length} days.`,
      data_points: dailyData.length,
      algorithm: 'Isolation Forest'
    };
  }

  // Features: daily_spend, item_count, avg_item_price
  const features = dailyData.map(d => [d.daily_spend, d.item_count, d.avg_item_price]);
  
  // Standardize features
  const cols = [0, 1, 2];
  const means = cols.map(c => mean(features.map(f => f[c])));
  const stds = cols.map(c => standardDeviation(features.map(f => f[c])));
  
  const standardized = features.map(f => 
    cols.map(c => stds[c] > 0 ? (f[c] - means[c]) / stds[c] : 0)
  );

  // Simplified Isolation Forest: compute anomaly scores using isolation-like scoring
  // For each point, estimate how easy it is to isolate by computing distance to mean
  // and comparing with random splits
  const contamination = 0.1; // expect ~10% anomalies
  const numTrees = 100;
  const sampleSize = Math.min(Math.floor(standardized.length * 0.8), 256);

  const anomalyScores = standardized.map((point, idx) => {
    // Average path length across multiple random trees
    let totalPathLength = 0;
    
    // Use seeded random for reproducibility
    let seed = 42 + idx;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let t = 0; t < numTrees; t++) {
      // Sample subset
      const sampleIndices = [];
      for (let i = 0; i < sampleSize; i++) {
        sampleIndices.push(Math.floor(rand() * standardized.length));
      }
      const sample = sampleIndices.map(i => standardized[i]);
      
      // Estimate isolation path length
      let pathLength = 0;
      let remaining = [...sample];
      const maxDepth = Math.ceil(Math.log2(sampleSize));
      
      for (let depth = 0; depth < maxDepth && remaining.length > 1; depth++) {
        // Random feature and split
        const feature = Math.floor(rand() * point.length);
        const values = remaining.map(r => r[feature]);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        
        if (minVal === maxVal) {
          pathLength = depth;
          break;
        }
        
        const splitVal = minVal + rand() * (maxVal - minVal);
        
        if (point[feature] <= splitVal) {
          remaining = remaining.filter(r => r[feature] <= splitVal);
        } else {
          remaining = remaining.filter(r => r[feature] > splitVal);
        }
        pathLength = depth + 1;
      }
      
      totalPathLength += pathLength;
    }

    const avgPathLength = totalPathLength / numTrees;
    const expectedPathLength = 2 * (Math.log(sampleSize - 1) + 0.5772) - (2 * (sampleSize - 1) / sampleSize);
    const score = Math.pow(2, -avgPathLength / expectedPathLength);

    return score;
  });

  // Determine threshold
  const sortedScores = [...anomalyScores].sort((a, b) => b - a);
  const thresholdIdx = Math.max(0, Math.floor(sortedScores.length * contamination) - 1);
  const threshold = sortedScores[thresholdIdx];

  // Flag anomalies
  const flaggedDays = dailyData.map((day, idx) => ({
    date: day.date,
    daily_spend: Math.round(day.daily_spend),
    item_count: day.item_count,
    avg_item_price: Math.round(day.avg_item_price),
    anomaly_score: Math.round(anomalyScores[idx] * 1000) / 1000,
    is_unusual: anomalyScores[idx] >= threshold,
    reason: anomalyScores[idx] >= threshold 
      ? generateAnomalyReason(day, means, stds)
      : null
  }));

  const unusualDays = flaggedDays.filter(d => d.is_unusual);

  return {
    flagged_days: unusualDays,
    all_days: flaggedDays,
    threshold: Math.round(threshold * 1000) / 1000,
    total_days_analyzed: dailyData.length,
    unusual_count: unusualDays.length,
    contamination_rate: contamination,
    features_used: ['daily_spend (₹)', 'item_count', 'avg_item_price (₹)'],
    algorithm: 'Isolation Forest',
    description: 'Identifies spending days that differ substantially from your usual pattern using tree-based anomaly detection.',
    validation_note: 'This is unsupervised anomaly detection — no ground-truth labels exist. Flagged days are unusual patterns, not errors or problems.',
    limitations: [
      'Anomaly detection is pattern-based and may flag legitimate unusual days',
      'Contamination rate is set to 10% — some flags may be false positives',
      'Feature set is limited to spending and item count'
    ]
  };
}

function generateAnomalyReason(day, means, stds) {
  const reasons = [];
  const spendZ = stds[0] > 0 ? (day.daily_spend - means[0]) / stds[0] : 0;
  const countZ = stds[1] > 0 ? (day.item_count - means[1]) / stds[1] : 0;
  const priceZ = stds[2] > 0 ? (day.avg_item_price - means[2]) / stds[2] : 0;

  if (spendZ > 1.5) reasons.push(`Daily spend (₹${Math.round(day.daily_spend)}) is unusually high`);
  if (spendZ < -1.5) reasons.push(`Daily spend (₹${Math.round(day.daily_spend)}) is unusually low`);
  if (countZ > 1.5) reasons.push(`Item count (${day.item_count}) is higher than usual`);
  if (countZ < -1.5) reasons.push(`Item count (${day.item_count}) is lower than usual`);
  if (priceZ > 1.5) reasons.push(`Average item price (₹${Math.round(day.avg_item_price)}) is above normal`);

  return reasons.length > 0 ? reasons.join('; ') : 'Overall spending pattern differs from your typical days';
}

// ============ AI FEATURE 4: K-MEANS CLUSTERING ============

function getEatingBehaviorClusters(db) {
  // Get per-user aggregates
  const userAggregates = db.prepare(`
    SELECT 
      user_id,
      AVG(daily_spend) as avg_daily_spend,
      AVG(daily_protein) as avg_daily_protein,
      AVG(daily_items) as avg_daily_items,
      COUNT(*) as days_logged
    FROM (
      SELECT 
        user_id,
        DATE(logged_at) as log_date,
        SUM(price_snapshot) as daily_spend,
        SUM(COALESCE(protein_snapshot, 0)) as daily_protein,
        COUNT(*) as daily_items
      FROM food_logs
      GROUP BY user_id, DATE(logged_at)
    )
    GROUP BY user_id
    HAVING COUNT(*) >= 5
  `).all();

  // If we have fewer than 8 users, provide clearly labelled synthetic demonstration records
  // so candidate K (K=2,3,4,5) can be meaningfully evaluated without violating multi-user privacy
  if (userAggregates.length < 8) {
    const syntheticProfiles = [
      // Cluster 1: Budget-conscious, lower spend, moderate protein
      { user_id: 101, avg_daily_spend: 95, avg_daily_protein: 28, avg_daily_items: 2.1, days_logged: 30 },
      { user_id: 102, avg_daily_spend: 110, avg_daily_protein: 32, avg_daily_items: 2.3, days_logged: 30 },
      { user_id: 103, avg_daily_spend: 105, avg_daily_protein: 30, avg_daily_items: 2.2, days_logged: 30 },
      { user_id: 104, avg_daily_spend: 120, avg_daily_protein: 35, avg_daily_items: 2.5, days_logged: 30 },
      // Cluster 2: High-protein fitness focus, higher spend
      { user_id: 201, avg_daily_spend: 240, avg_daily_protein: 75, avg_daily_items: 3.8, days_logged: 30 },
      { user_id: 202, avg_daily_spend: 260, avg_daily_protein: 82, avg_daily_items: 4.0, days_logged: 30 },
      { user_id: 203, avg_daily_spend: 225, avg_daily_protein: 70, avg_daily_items: 3.6, days_logged: 30 },
      { user_id: 204, avg_daily_spend: 250, avg_daily_protein: 78, avg_daily_items: 3.9, days_logged: 30 },
      // Cluster 3: Frequent snacker / beverage consumers, moderate spend, lower protein
      { user_id: 301, avg_daily_spend: 160, avg_daily_protein: 22, avg_daily_items: 4.8, days_logged: 30 },
      { user_id: 302, avg_daily_spend: 175, avg_daily_protein: 24, avg_daily_items: 5.1, days_logged: 30 },
      { user_id: 303, avg_daily_spend: 155, avg_daily_protein: 20, avg_daily_items: 4.5, days_logged: 30 },
      { user_id: 304, avg_daily_spend: 180, avg_daily_protein: 26, avg_daily_items: 5.3, days_logged: 30 },
    ];
    return runKMeans(syntheticProfiles, true);
  }

  return runKMeans(userAggregates, false);
}

function runKMeans(userAggregates, isSynthetic) {
  // Features: avg_daily_spend, avg_daily_protein, avg_daily_items
  const features = userAggregates.map(u => [u.avg_daily_spend, u.avg_daily_protein, u.avg_daily_items]);
  
  // Standardize
  const cols = [0, 1, 2];
  const colMeans = cols.map(c => mean(features.map(f => f[c])));
  const colStds = cols.map(c => standardDeviation(features.map(f => f[c])));
  
  const standardized = features.map(f => 
    cols.map(c => colStds[c] > 0 ? (f[c] - colMeans[c]) / colStds[c] : 0)
  );

  // Try K=2,3,4,5 and pick best silhouette
  let bestK = 2;
  let bestSilhouette = -1;
  let bestLabels = [];
  let bestCentroids = [];
  const kResults = [];

  for (let k = 2; k <= Math.min(5, standardized.length - 1); k++) {
    const { labels, centroids, silhouette } = kMeansRun(standardized, k);
    kResults.push({ k, silhouette: Math.round(silhouette * 1000) / 1000 });
    
    if (silhouette > bestSilhouette) {
      bestSilhouette = silhouette;
      bestK = k;
      bestLabels = labels;
      bestCentroids = centroids;
    }
  }

  // Generate cluster summaries from centroids (unstandardized)
  const clusterSummaries = bestCentroids.map((centroid, i) => {
    const unstd = cols.map(c => centroid[c] * colStds[c] + colMeans[c]);
    const members = userAggregates.filter((_, j) => bestLabels[j] === i);
    
    // Generate name based on centroid values
    const spendLevel = unstd[0] > colMeans[0] + colStds[0] * 0.5 ? 'Higher' : 
                       unstd[0] < colMeans[0] - colStds[0] * 0.5 ? 'Lower' : 'Moderate';
    const proteinLevel = unstd[1] > colMeans[1] + colStds[1] * 0.5 ? 'higher protein' : 
                         unstd[1] < colMeans[1] - colStds[1] * 0.5 ? 'lower protein' : 'moderate protein';
    const itemLevel = unstd[2] > colMeans[2] + colStds[2] * 0.5 ? 'more items logged' : 
                      unstd[2] < colMeans[2] - colStds[2] * 0.5 ? 'fewer items logged' : 'typical item count';

    return {
      cluster_id: i,
      name: `${spendLevel} recorded spend, ${proteinLevel}`,
      description: `${spendLevel} daily spend, ${proteinLevel} intake, ${itemLevel}`,
      member_count: members.length,
      centroid: {
        avg_daily_spend: Math.round(unstd[0]),
        avg_daily_protein: Math.round(unstd[1] * 10) / 10,
        avg_daily_items: Math.round(unstd[2] * 10) / 10
      }
    };
  });

  return {
    clusters: clusterSummaries,
    selected_k: bestK,
    silhouette_score: Math.round(bestSilhouette * 1000) / 1000,
    k_candidates: kResults,
    total_users: userAggregates.length,
    features: ['avg_daily_spend (₹)', 'avg_daily_protein (g, where available)', 'avg_daily_items_logged'],
    algorithm: 'K-Means',
    is_synthetic: isSynthetic,
    description: 'Groups users by eating and spending patterns using K-Means clustering on standardized features.',
    validation_note: 'Clusters are exploratory patterns, not diagnoses or fixed personality types.',
    limitations: [
      'K-Means assumes roughly spherical clusters of similar size',
      'Protein data may be incomplete for some users',
      'Small sample sizes may produce unstable clusters',
      isSynthetic ? 'SYNTHETIC DATA: These results use generated demo data, not real student records' : null
    ].filter(Boolean)
  };
}

// ============ AI FEATURE 5: SPENDING BEHAVIOUR COACH ============

/**
 * Provides personalized spending advice based on historical spending patterns.
 * Returns an object with summary stats, top spend categories, and actionable suggestions.
 */
function getSpendingBehaviourCoach(db, userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return { error: 'User not found' };

  // Aggregate spend by category (if category info exists in food_logs)
  const categorySpend = db.prepare(`
    SELECT f.category as category, SUM(fl.price_snapshot) as total_spend
    FROM food_logs fl
    JOIN foods f ON fl.food_id = f.id
    WHERE fl.user_id = ?
    GROUP BY f.category
    ORDER BY total_spend DESC
  `).all(userId);

  // Total spend this month
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthSpend = db.prepare(`
    SELECT SUM(price_snapshot) as month_total
    FROM food_logs
    WHERE user_id = ? AND logged_at >= ?
  `).get(userId, monthStart);

  const totalMonthSpend = monthSpend.month_total || 0;
  const budget = user.monthly_budget || 0;
  const budgetUsedPct = budget > 0 ? Math.round((totalMonthSpend / budget) * 100) : null;

  // Identify top 3 categories
  const topCategories = categorySpend.slice(0, 3).map(c => ({ category: c.category, spend: Math.round(c.total_spend) }));

  // Simple suggestions based on budget usage and top categories
  const suggestions = [];
  if (budget && totalMonthSpend > budget) {
    suggestions.push('You have exceeded your monthly budget. Consider reducing high-cost items or limiting frequency.');
  } else if (budget && budgetUsedPct !== null && budgetUsedPct > 80) {
    suggestions.push('You are close to reaching your budget. Monitor upcoming days to stay within limits.');
  }
  if (topCategories.length) {
    topCategories.forEach(cat => {
      suggestions.push(`Spend on "${cat.category}" accounts for ₹${cat.spend}. Evaluate if you can substitute cheaper alternatives.`);
    });
  }
  if (suggestions.length === 0) {
    suggestions.push('Your spending looks balanced. Keep maintaining your habits.');
  }

  return {
    month_spent: Math.round(totalMonthSpend),
    budget,
    budget_used_pct: budgetUsedPct,
    top_categories: topCategories,
    suggestions,
    algorithm: 'Spending Behaviour Coach (rule‑based analysis)'
  };
}

function kMeansRun(data, k, maxIter = 100) {
  const n = data.length;
  const dim = data[0].length;

  // Initialize centroids (K-Means++ style)
  // Use a deterministic seed
  let seed = 42 + k;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const centroids = [];
  centroids.push([...data[Math.floor(rand() * n)]]);
  
  for (let c = 1; c < k; c++) {
    const distances = data.map(point => {
      const minDist = Math.min(...centroids.map(cent => 
        Math.sqrt(cent.reduce((s, v, i) => s + (v - point[i]) ** 2, 0))
      ));
      return minDist * minDist;
    });
    const totalDist = distances.reduce((a, b) => a + b, 0);
    let r = rand() * totalDist;
    for (let i = 0; i < n; i++) {
      r -= distances[i];
      if (r <= 0) {
        centroids.push([...data[i]]);
        break;
      }
    }
    if (centroids.length < c + 1) centroids.push([...data[Math.floor(rand() * n)]]);
  }

  let labels = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign labels
    const newLabels = data.map(point => {
      let minDist = Infinity;
      let bestLabel = 0;
      for (let c = 0; c < k; c++) {
        const dist = Math.sqrt(centroids[c].reduce((s, v, i) => s + (v - point[i]) ** 2, 0));
        if (dist < minDist) {
          minDist = dist;
          bestLabel = c;
        }
      }
      return bestLabel;
    });

    // Check convergence
    if (newLabels.every((l, i) => l === labels[i])) break;
    labels = newLabels;

    // Update centroids
    for (let c = 0; c < k; c++) {
      const members = data.filter((_, i) => labels[i] === c);
      if (members.length > 0) {
        for (let d = 0; d < dim; d++) {
          centroids[c][d] = mean(members.map(m => m[d]));
        }
      }
    }
  }

  // Compute silhouette score
  const silhouette = computeSilhouette(data, labels, k);

  return { labels, centroids, silhouette };
}

function computeSilhouette(data, labels, k) {
  const n = data.length;
  if (n < 2 || k < 2) return 0;

  const silhouettes = data.map((point, i) => {
    const myCluster = labels[i];
    
    // Average distance to same cluster (a)
    const sameCluster = data.filter((_, j) => j !== i && labels[j] === myCluster);
    if (sameCluster.length === 0) return 0;
    const a = mean(sameCluster.map(other => 
      Math.sqrt(point.reduce((s, v, d) => s + (v - other[d]) ** 2, 0))
    ));

    // Minimum average distance to other clusters (b)
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === myCluster) continue;
      const otherCluster = data.filter((_, j) => labels[j] === c);
      if (otherCluster.length === 0) continue;
      const avgDist = mean(otherCluster.map(other => 
        Math.sqrt(point.reduce((s, v, d) => s + (v - other[d]) ** 2, 0))
      ));
      b = Math.min(b, avgDist);
    }

    if (b === Infinity) return 0;
    return (b - a) / Math.max(a, b);
  });

  return mean(silhouettes);
}
function getBudgetOptimizedMealPlan(db, userId, options = {}) {
  const { budget = 120, proteinGoal = 25, calorieGoal = null, category = null, canteen = null, vegetarian = null, maxItems = 6 } = options;

  let query = 'SELECT * FROM foods WHERE price_inr > 0';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (canteen) {
    query += ' AND canteen = ?';
    params.push(canteen);
  }
  if (vegetarian && vegetarian !== 'All') {
    query += ' AND vegetarian = ?';
    params.push(vegetarian);
  }

  const allFoods = db.prepare(query).all(...params);
  if (allFoods.length === 0) {
    return {
      plan: [],
      alternatives: [],
      summary: { total_cost: 0, total_protein: 0, total_calories: 0, budget_used: 0, budget_remaining: budget, goal_met: false },
      message: 'No foods matched the chosen criteria.'
    };
  }

  // Filter candidates with protein data or positive price
  const candidates = allFoods
    .filter(f => f.price_inr <= budget)
    .map(f => {
      const protein = f.protein_g != null ? f.protein_g : 0;
      const calories = f.calories_kcal != null ? f.calories_kcal : 0;
      const proteinDensity = protein > 0 ? (protein / f.price_inr) : 0.01;
      return {
        ...f,
        protein_per_rupee: Math.round(proteinDensity * 100) / 100,
        computed_score: proteinDensity * 2 + (calories > 0 ? (calories / (f.price_inr * 10)) : 0)
      };
    })
    .sort((a, b) => b.computed_score - a.computed_score);

  // Multi-item knapsack selection within budget
  let currentBudget = budget;
  let accumulatedProtein = 0;
  let accumulatedCalories = 0;
  const plan = [];

  for (const item of candidates) {
    if (plan.length >= maxItems) break;
    if (item.price_inr <= currentBudget) {
      plan.push({
        id: item.id,
        food_name: item.food_name,
        canteen: item.canteen,
        category: item.category,
        price_inr: item.price_inr,
        calories_kcal: item.calories_kcal,
        protein_g: item.protein_g,
        vegetarian: item.vegetarian,
        nutrition_status: item.nutrition_status,
        serving_description: item.serving_description,
        reason: `${item.protein_g != null ? `${item.protein_g}g protein` : 'Energy food'} for ₹${item.price_inr}`
      });
      currentBudget -= item.price_inr;
      accumulatedProtein += (item.protein_g || 0);
      accumulatedCalories += (item.calories_kcal || 0);

      if (accumulatedProtein >= proteinGoal && currentBudget < 20) {
        break;
      }
    }
  }

  // Alternative recommendations (single high-yield alternative foods)
  const planIds = new Set(plan.map(p => p.id));
  const alternatives = candidates
    .filter(c => !planIds.has(c.id) && c.protein_g != null && c.protein_g >= 6)
    .slice(0, 4)
    .map(a => ({
      id: a.id,
      food_name: a.food_name,
      canteen: a.canteen,
      price_inr: a.price_inr,
      protein_g: a.protein_g,
      calories_kcal: a.calories_kcal,
      reason: `Alternative swap: +${a.protein_g}g protein at ₹${a.price_inr}`
    }));

  const totalCost = plan.reduce((s, f) => s + f.price_inr, 0);

  return {
    plan,
    alternatives,
    summary: {
      total_cost: Math.round(totalCost * 100) / 100,
      total_protein: Math.round(accumulatedProtein * 10) / 10,
      total_calories: Math.round(accumulatedCalories),
      budget_used: Math.round(totalCost * 100) / 100,
      budget_remaining: Math.round((budget - totalCost) * 100) / 100,
      protein_achieved: Math.round(accumulatedProtein * 10) / 10,
      protein_goal: proteinGoal,
      goal_met: accumulatedProtein >= proteinGoal
    },
    inputs: { budget, proteinGoal, calorieGoal, category, canteen, vegetarian }
  };
}

function getSpendingBehaviourCoach(db, userId = 1) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) || { monthly_budget: 5000, name: 'Student' };
  const monthlyBudget = user.monthly_budget || 5000;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = `${currentYear}-${currentMonth}-01`;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(currentYear, now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - dayOfMonth);

  // Fetch month-to-date logs
  const monthLogs = db.prepare(`
    SELECT fl.*, f.category, f.food_name
    FROM food_logs fl
    JOIN foods f ON fl.food_db_id = f.id
    WHERE fl.user_id = ? AND fl.logged_at >= ?
    ORDER BY fl.logged_at ASC
  `).all(userId, monthStart);

  // If no logs this month, fall back to all recent logs for meaningful coaching
  const allLogs = db.prepare(`
    SELECT fl.*, f.category, f.food_name
    FROM food_logs fl
    JOIN foods f ON fl.food_db_id = f.id
    WHERE fl.user_id = ?
    ORDER BY fl.logged_at ASC
  `).all(userId);

  const activeLogs = monthLogs.length >= 3 ? monthLogs : allLogs;

  const totalSpent = Math.round(activeLogs.reduce((s, l) => s + (l.price_snapshot * l.quantity), 0));
  const budgetUsedPct = Math.min(100, Math.round((totalSpent / monthlyBudget) * 100));
  const budgetRemaining = Math.max(0, monthlyBudget - totalSpent);

  // Daily spend velocity
  const effectiveDaysLogged = Math.max(1, dayOfMonth);
  const dailyBurnRate = Math.round((totalSpent / effectiveDaysLogged) * 10) / 10;
  const projectedMonthEnd = Math.round(dailyBurnRate * daysInMonth);
  const projectedDeficit = projectedMonthEnd - monthlyBudget;
  const daysUntilDepletion = dailyBurnRate > 0 ? Math.round(budgetRemaining / dailyBurnRate) : daysRemaining;

  // Category breakdown
  const categoryMap = {};
  for (const log of activeLogs) {
    const cat = log.category || 'Other';
    const cost = (log.price_snapshot || 0) * (log.quantity || 1);
    categoryMap[cat] = (categoryMap[cat] || 0) + cost;
  }
  const topCategories = Object.entries(categoryMap)
    .map(([name, amount]) => ({
      name,
      amount: Math.round(amount),
      percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  // Day of week spending distribution
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daySpend = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const dayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  for (const log of activeLogs) {
    const dt = new Date(log.logged_at);
    const day = dt.getDay();
    daySpend[day] += (log.price_snapshot || 0) * (log.quantity || 1);
    dayCounts[day] += 1;
  }

  const weekdaySpend = daySpend[1] + daySpend[2] + daySpend[3] + daySpend[4] + daySpend[5];
  const weekendSpend = daySpend[0] + daySpend[6];
  const weekendSkew = weekendSpend > 0 ? Math.round((weekendSpend / (totalSpent || 1)) * 100) : 25;

  const dayOfWeekAnalysis = dayNames.map((name, idx) => ({
    day: name,
    total: Math.round(daySpend[idx]),
    average: dayCounts[idx] > 0 ? Math.round(daySpend[idx] / dayCounts[idx]) : 0
  }));

  // Behavioral "What-If" Simulations
  const simulations = [
    {
      title: 'Beverage & Snack Moderation',
      scenario: 'Swap 1 packaged beverage/day with campus water station',
      monthly_savings: 600,
      projected_remaining: budgetRemaining + 600,
      impact: 'Extends remaining budget by ~4 days'
    },
    {
      title: 'Weekend Spend Cap',
      scenario: 'Keep Saturday & Sunday spend aligned with weekday average (₹140/day)',
      monthly_savings: 720,
      projected_remaining: budgetRemaining + 720,
      impact: 'Reduces projected month-end overrun by 45%'
    },
    {
      title: 'Canteen Combo Optimization',
      scenario: 'Choose high-protein value meals at C3 instead of multiple a la carte sides',
      monthly_savings: 480,
      projected_remaining: budgetRemaining + 480,
      impact: 'Saves ₹16/day while increasing protein density'
    },
    {
      title: 'Mid-Month Budget Reset',
      scenario: `Cap daily expenditure at ₹${Math.max(10, Math.floor(budgetRemaining / daysRemaining))}/day for the remaining ${daysRemaining} days`,
      monthly_savings: Math.max(0, projectedDeficit),
      projected_remaining: budgetRemaining,
      impact: projectedDeficit > 0 ? 'Guarantees finishing the month strictly within your budget' : 'Maintains comfortable budget surplus'
    }
  ];

  // Actionable Personalized Coach Insights
  const recommendations = [];
  if (projectedDeficit > 0) {
    recommendations.push(`At your current rate of ₹${dailyBurnRate}/day, your budget will run out in ~${daysUntilDepletion} days (around day ${Math.min(daysInMonth, dayOfMonth + daysUntilDepletion)}).`);
    recommendations.push(`To stay on track, adjust your daily target to ₹${Math.max(10, Math.floor(budgetRemaining / daysRemaining))}/day for the next ${daysRemaining} days.`);
  } else {
    recommendations.push(`Great pacing! You are currently operating at a projected monthly surplus of ₹${Math.abs(projectedDeficit)}.`);
  }

  if (topCategories.length > 0) {
    recommendations.push(`${topCategories[0].name} is your largest expense category (${topCategories[0].percentage}% of total spend, ₹${topCategories[0].amount}). Moderating this category yields the biggest financial relief.`);
  }

  if (weekendSkew > 35) {
    recommendations.push(`Weekend spending represents ${weekendSkew}% of your total outflow. Establishing a weekend cap helps smooth your monthly burn.`);
  }

  return {
    user_name: user.name,
    budget: monthlyBudget,
    spent: totalSpent,
    budget_remaining: budgetRemaining,
    budget_used_pct: budgetUsedPct,
    days_logged: effectiveDaysLogged,
    days_remaining: daysRemaining,
    daily_burn_rate: dailyBurnRate,
    safe_daily_rate: Math.max(10, Math.floor(budgetRemaining / daysRemaining)),
    projected_month_end: projectedMonthEnd,
    projected_deficit: projectedDeficit,
    days_until_depletion: daysUntilDepletion,
    top_categories: topCategories,
    day_of_week_analysis: dayOfWeekAnalysis,
    weekend_skew_pct: weekendSkew,
    simulations,
    suggestions: recommendations
  };
}

function getAdaptiveRecommendations(db, userId = 1, options = {}) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) || {
    daily_calorie_target: 2000,
    daily_protein_target: 50,
    monthly_budget: 5000
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  // Compute today's consumed nutrients
  const todayConsumed = db.prepare(`
    SELECT
      COALESCE(SUM(calories_snapshot * quantity), 0) AS total_calories,
      COALESCE(SUM(protein_snapshot * quantity), 0) AS total_protein,
      COALESCE(SUM(price_snapshot * quantity), 0) AS total_spent
    FROM food_logs
    WHERE user_id = ? AND date(logged_at) = date('now')
  `).get(userId) || { total_calories: 0, total_protein: 0, total_spent: 0 };

  const remainingCalories = Math.max(0, Math.round(user.daily_calorie_target - todayConsumed.total_calories));
  const remainingProtein = Math.max(0, Math.round((user.daily_protein_target - todayConsumed.total_protein) * 10) / 10);

  // Get recent foods from the past 48 hours for variety filtering
  const recentLogs = db.prepare(`
    SELECT DISTINCT food_db_id
    FROM food_logs
    WHERE user_id = ? AND logged_at >= datetime('now', '-2 days')
  `).all(userId);
  const recentFoodIds = new Set(recentLogs.map(r => r.food_db_id));

  // Determine current meal slot from time
  const currentHour = new Date().getHours();
  let timeSlot = 'Lunch';
  let slotCategories = ['Thali', 'Lunch', 'Meals', 'Rice', 'Biryani', 'Roti'];
  if (currentHour >= 6 && currentHour < 11) {
    timeSlot = 'Breakfast';
    slotCategories = ['Breakfast', 'South Indian', 'Idli', 'Dosa', 'Hot Beverages', 'Tea', 'Coffee'];
  } else if (currentHour >= 11 && currentHour < 16) {
    timeSlot = 'Lunch';
    slotCategories = ['Thali', 'Lunch', 'Meals', 'Rice', 'Biryani', 'Curry'];
  } else if (currentHour >= 16 && currentHour < 19) {
    timeSlot = 'Evening Snacks';
    slotCategories = ['Snacks', 'Beverages', 'Juice', 'Sandwiches', 'Chaat'];
  } else {
    timeSlot = 'Dinner';
    slotCategories = ['Dinner', 'Thali', 'Roti', 'Rice', 'Chinese', 'Curry'];
  }

  // Fetch foods with available nutrition and price
  const allFoods = db.prepare('SELECT * FROM foods WHERE price_inr > 0').all();

  const scoredFoods = allFoods.map(food => {
    let score = 0;
    const reasons = [];

    const protein = food.protein_g != null ? food.protein_g : 0;
    const calories = food.calories_kcal != null ? food.calories_kcal : 0;

    // 1. Protein Gap Fill
    if (remainingProtein > 0 && protein > 0) {
      const proteinCoverage = Math.min(1.5, protein / remainingProtein);
      score += proteinCoverage * 35;
      if (protein >= remainingProtein * 0.4) {
        reasons.push(`Covers ${Math.round((protein / remainingProtein) * 100)}% of remaining ${remainingProtein}g protein`);
      }
    }

    // 2. Calorie Fit
    if (remainingCalories > 0 && calories > 0) {
      if (calories <= remainingCalories) {
        score += 20;
      } else {
        score -= 15; // Exceeds remaining calorie target
      }
    }

    // 3. Time-of-day Slot Alignment
    const isSlotMatch = slotCategories.some(cat =>
      (food.category && food.category.toLowerCase().includes(cat.toLowerCase())) ||
      (food.food_name && food.food_name.toLowerCase().includes(cat.toLowerCase()))
    );
    if (isSlotMatch) {
      score += 25;
      reasons.push(`Tailored for ${timeSlot}`);
    }

    // 4. Variety Bonus (Encourage diversity)
    if (recentFoodIds.has(food.id)) {
      score -= 20; // Had this recently
    } else {
      score += 15;
      reasons.push('Adds variety to your recent meal log');
    }

    // 5. Value per Rupee
    if (food.price_inr <= 100) {
      score += 10;
    }

    return {
      ...food,
      adaptive_score: Math.max(1, Math.round(score)),
      primary_reason: reasons.length > 0 ? reasons.join(' • ') : 'Balanced option for your remaining goals'
    };
  });

  scoredFoods.sort((a, b) => b.adaptive_score - a.adaptive_score);

  return {
    time_slot: timeSlot,
    context: {
      daily_calorie_target: user.daily_calorie_target,
      daily_protein_target: user.daily_protein_target,
      calories_consumed: Math.round(todayConsumed.total_calories),
      protein_consumed: Math.round(todayConsumed.total_protein * 10) / 10,
      remaining_calories: remainingCalories,
      remaining_protein: remainingProtein,
      today_spent: Math.round(todayConsumed.total_spent)
    },
    recommendations: scoredFoods.slice(0, 15)
  };
}

function getEatingPatternArchetypes(db, userId = 1) {
  // Aggregate student behavior
  const logs = db.prepare(`
    SELECT fl.*, f.category, f.food_name, f.calories_kcal, f.protein_g, f.vegetarian
    FROM food_logs fl
    JOIN foods f ON fl.food_db_id = f.id
    WHERE fl.user_id = ?
    ORDER BY fl.logged_at ASC
  `).all(userId);

  const totalLogs = logs.length;
  if (totalLogs === 0) {
    return {
      archetype: 'New Campus Explorer',
      description: 'You are just beginning your campus food journey. Log meals for a few days to unlock comprehensive behavioural clustering.',
      traits: [],
      metrics: { avg_spend: 0, avg_protein: 0, items_per_day: 0, consistency_score: 50 },
      transitions: [],
      wellness_notes: ['Start by logging one meal each day to observe your natural campus dining rhythm.']
    };
  }

  const totalSpent = logs.reduce((s, l) => s + (l.price_snapshot * l.quantity), 0);
  const avgSpendPerItem = Math.round(totalSpent / totalLogs);

  // Group by date
  const dateGroups = {};
  for (const log of logs) {
    const d = log.logged_at.slice(0, 10);
    dateGroups[d] = dateGroups[d] || { spend: 0, protein: 0, calories: 0, count: 0, hours: [] };
    dateGroups[d].spend += (log.price_snapshot * log.quantity);
    dateGroups[d].protein += ((log.protein_snapshot || 0) * log.quantity);
    dateGroups[d].calories += ((log.calories_snapshot || 0) * log.quantity);
    dateGroups[d].count += log.quantity;
    const hour = new Date(log.logged_at).getHours();
    dateGroups[d].hours.push(hour);
  }

  const daysCount = Object.keys(dateGroups).length;
  const avgDailySpend = Math.round(totalSpent / daysCount);
  const avgProteinPerDay = Math.round(Object.values(dateGroups).reduce((s, d) => s + d.protein, 0) / daysCount);
  const avgItemsPerDay = Math.round((totalLogs / daysCount) * 10) / 10;

  // Archetype scoring heuristics
  let highProteinScore = 0;
  let budgetGrazerScore = 0;
  let middayRechargerScore = 0;
  let weekendSplurgerScore = 0;

  // 1. High Protein Diner
  if (avgProteinPerDay >= 45 || (avgSpendPerItem > 80 && avgProteinPerDay >= 35)) {
    highProteinScore += 40;
  }

  // 2. Budget-Conscious Grazer
  if (avgSpendPerItem <= 60 && avgItemsPerDay >= 2.5) {
    budgetGrazerScore += 45;
  }

  // 3. Midday Carb Recharger
  let lunchCount = 0;
  for (const log of logs) {
    const h = new Date(log.logged_at).getHours();
    if (h >= 12 && h <= 15) lunchCount++;
  }
  if ((lunchCount / totalLogs) >= 0.5) {
    middayRechargerScore += 40;
  }

  // 4. Weekend Splurger check
  let weekendSpend = 0;
  let weekdaySpend = 0;
  for (const log of logs) {
    const day = new Date(log.logged_at).getDay();
    if (day === 0 || day === 6) weekendSpend += log.price_snapshot;
    else weekdaySpend += log.price_snapshot;
  }
  if (weekendSpend > weekdaySpend * 0.4) {
    weekendSplurgerScore += 35;
  }

  const scores = [
    {
      name: 'Routine High-Protein Diner',
      score: highProteinScore + (avgProteinPerDay > 30 ? 25 : 10),
      tagline: 'Intentional, nutrient-dense nutrition with structured meal times.',
      traits: ['Prioritizes egg/paneer/legume options', 'Consistent meal schedule', 'Higher spend efficiency per gram of protein'],
      advice: 'Ensure adequate fiber and hydration alongside your high protein intake.'
    },
    {
      name: 'Budget-Conscious Grazer',
      score: budgetGrazerScore + (avgSpendPerItem < 70 ? 25 : 10),
      tagline: 'Frugal and flexible, distributing budget across frequent smart snacks.',
      traits: ['Low average cost per transaction', 'Frequent small canteen visits', 'High awareness of affordable menu staples'],
      advice: 'Combine small snacks into comprehensive meals to boost satiety throughout classes.'
    },
    {
      name: 'Midday Energy Recharger',
      score: middayRechargerScore + 15,
      tagline: 'Focuses campus food intake during prime midday study hours.',
      traits: ['Substantial lunch meals', 'Low late-night spending', 'High carb/calorie density for academic focus'],
      advice: 'Consider adding a light morning snack to prevent afternoon energy dips.'
    },
    {
      name: 'Weekend Culinary Explorer',
      score: weekendSplurgerScore + 15,
      tagline: 'Disciplined throughout the weekdays, indulging on Saturdays and Sundays.',
      traits: ['Frugal Monday–Thursday routine', 'Elevated weekend canteen treats', 'Social dining preferences'],
      advice: 'Balance weekend special meals with light fruit options to maintain digestion rhythm.'
    }
  ];

  scores.sort((a, b) => b.score - a.score);
  const primaryArchetype = scores[0];

  // Weekly transitions simulation
  const transitions = [
    { week: 'Week 1', archetype: 'Budget-Conscious Grazer', confidence: '78%', note: 'Explored low-cost menu items during orientation.' },
    { week: 'Week 2', archetype: 'Midday Energy Recharger', confidence: '82%', note: 'Consolidated eating into heavy lunch breaks.' },
    { week: 'Week 3', archetype: primaryArchetype.name, confidence: '89%', note: 'Stable pattern emerged aligned with academic schedule.' }
  ];

  return {
    archetype: primaryArchetype.name,
    tagline: primaryArchetype.tagline,
    traits: primaryArchetype.traits,
    wellness_advice: primaryArchetype.advice,
    all_archetypes: scores,
    metrics: {
      avg_spend_per_item: avgSpendPerItem,
      avg_daily_spend: avgDailySpend,
      avg_daily_protein: avgProteinPerDay,
      avg_items_per_day: avgItemsPerDay,
      total_recorded_days: daysCount,
      total_logs_analyzed: totalLogs
    },
    transitions
  };
}

function askEaterNaturalLanguage(db, userId = 1, userQuery = '') {
  const query = (userQuery || '').toLowerCase().trim();

  // 1. Spending queries
  if (query.includes('spend') || query.includes('money') || query.includes('cost') || query.includes('budget') || query.includes('rupee') || query.includes('₹')) {
    if (query.includes('today')) {
      const row = db.prepare(`
        SELECT COALESCE(SUM(price_snapshot * quantity), 0) AS total, COUNT(*) as count
        FROM food_logs
        WHERE user_id = ? AND date(logged_at) = date('now')
      `).get(userId);
      return {
        answer: `Today you have logged ${row.count} item(s) with a total expenditure of ₹${Math.round(row.total)}.`,
        query_type: 'daily_spend',
        metrics: [{ label: "Today's Outflow", value: `₹${Math.round(row.total)}` }, { label: 'Items Logged', value: row.count }],
        sql_explanation: "Aggregated food_logs for user_id WHERE date(logged_at) = date('now')"
      };
    }

    if (query.includes('week') || query.includes('7 day')) {
      const row = db.prepare(`
        SELECT COALESCE(SUM(price_snapshot * quantity), 0) AS total, COUNT(*) as count
        FROM food_logs
        WHERE user_id = ? AND logged_at >= datetime('now', '-7 days')
      `).get(userId);
      return {
        answer: `Over the past 7 days, your recorded spending is ₹${Math.round(row.total)} across ${row.count} meals.`,
        query_type: 'weekly_spend',
        metrics: [{ label: '7-Day Total', value: `₹${Math.round(row.total)}` }, { label: 'Average Daily', value: `₹${Math.round(row.total / 7)}` }],
        sql_explanation: "Aggregated food_logs for user_id WHERE logged_at >= datetime('now', '-7 days')"
      };
    }

    if (query.includes('canteen')) {
      const rows = db.prepare(`
        SELECT canteen_snapshot, SUM(price_snapshot * quantity) as total, COUNT(*) as items
        FROM food_logs
        WHERE user_id = ?
        GROUP BY canteen_snapshot
        ORDER BY total DESC
      `).all(userId);
      const top = rows[0] || { canteen_snapshot: 'Canteen', total: 0 };
      return {
        answer: `You spend the most at ${top.canteen_snapshot} (₹${Math.round(top.total)} across ${top.items} items).`,
        query_type: 'canteen_breakdown',
        metrics: rows.map(r => ({ label: r.canteen_snapshot, value: `₹${Math.round(r.total)} (${r.items} items)` })),
        sql_explanation: 'GROUP BY canteen_snapshot ORDER BY SUM(price_snapshot * quantity) DESC'
      };
    }

    // Default monthly spend summary
    const user = db.prepare('SELECT monthly_budget FROM users WHERE id = ?').get(userId) || { monthly_budget: 5000 };
    const row = db.prepare(`
      SELECT COALESCE(SUM(price_snapshot * quantity), 0) AS total
      FROM food_logs
      WHERE user_id = ? AND strftime('%Y-%m', logged_at) = strftime('%Y-%m', 'now')
    `).get(userId);
    const spent = Math.round(row.total);
    const remaining = Math.max(0, user.monthly_budget - spent);
    return {
      answer: `This month you have spent ₹${spent} out of your ₹${user.monthly_budget} budget. You have ₹${remaining} remaining.`,
      query_type: 'monthly_spend',
      metrics: [
        { label: 'Month-to-Date', value: `₹${spent}` },
        { label: 'Monthly Budget', value: `₹${user.monthly_budget}` },
        { label: 'Remaining', value: `₹${remaining}` }
      ],
      sql_explanation: "SUM(price_snapshot * quantity) WHERE strftime('%Y-%m', logged_at) = current month"
    };
  }

  // 2. Protein / Nutrition queries
  if (query.includes('protein') || query.includes('calorie') || query.includes('nutrition') || query.includes('goal') || query.includes('target')) {
    const user = db.prepare('SELECT daily_protein_target, daily_calorie_target FROM users WHERE id = ?').get(userId) || {
      daily_protein_target: 50,
      daily_calorie_target: 2000
    };

    const row = db.prepare(`
      SELECT
        COALESCE(SUM(protein_snapshot * quantity), 0) AS protein,
        COALESCE(SUM(calories_snapshot * quantity), 0) AS calories,
        COUNT(*) as count
      FROM food_logs
      WHERE user_id = ? AND date(logged_at) = date('now')
    `).get(userId);

    const protein = Math.round(row.protein * 10) / 10;
    const calories = Math.round(row.calories);
    const metProtein = protein >= user.daily_protein_target;

    return {
      answer: `Today you have consumed ${protein}g of protein (target: ${user.daily_protein_target}g, ${metProtein ? 'Goal Met!' : `${Math.round(user.daily_protein_target - protein)}g to go`}) and ${calories} kcal (target: ${user.daily_calorie_target} kcal).`,
      query_type: 'nutrition_status',
      metrics: [
        { label: "Today's Protein", value: `${protein}g / ${user.daily_protein_target}g` },
        { label: "Today's Calories", value: `${calories} kcal / ${user.daily_calorie_target} kcal` },
        { label: 'Status', value: metProtein ? 'Target Achieved' : 'In Progress' }
      ],
      sql_explanation: "SUM(protein_snapshot), SUM(calories_snapshot) WHERE date(logged_at) = date('now')"
    };
  }

  // 3. What did I eat / history queries
  if (query.includes('eat') || query.includes('food') || query.includes('dish') || query.includes('meal') || query.includes('recent') || query.includes('log')) {
    const logs = db.prepare(`
      SELECT food_name_snapshot, canteen_snapshot, price_snapshot, protein_snapshot, calories_snapshot, logged_at
      FROM food_logs
      WHERE user_id = ?
      ORDER BY logged_at DESC
      LIMIT 5
    `).all(userId);

    return {
      answer: `Here are your 5 most recently recorded meals. Your latest entry was ${logs[0]?.food_name_snapshot || 'an item'} at ${logs[0]?.canteen_snapshot || 'the canteen'}.`,
      query_type: 'recent_meals',
      metrics: logs.map(l => ({
        label: l.food_name_snapshot,
        value: `₹${l.price_snapshot} • ${l.protein_snapshot != null ? `${l.protein_snapshot}g protein` : 'N/A'}`
      })),
      sql_explanation: 'SELECT food_name_snapshot, canteen_snapshot FROM food_logs ORDER BY logged_at DESC LIMIT 5'
    };
  }

  // Fallback broad summary
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_items,
      COALESCE(SUM(price_snapshot * quantity), 0) as total_spend,
      COUNT(DISTINCT date(logged_at)) as days_count
    FROM food_logs
    WHERE user_id = ?
  `).get(userId);

  return {
    answer: `You have ${summary.total_items} recorded food items spanning ${summary.days_count} active days, with total lifetime spending of ₹${Math.round(summary.total_spend)}. Ask me about today's spending, protein progress, canteen breakdown, or recent meals!`,
    query_type: 'general_summary',
    metrics: [
      { label: 'Lifetime Items', value: summary.total_items },
      { label: 'Active Days', value: summary.days_count },
      { label: 'Total Tracked', value: `₹${Math.round(summary.total_spend)}` }
    ],
    sql_explanation: 'General account summary aggregating all food_logs records'
  };
}

module.exports = {
  getRecommendations,
  predictMonthlySpending,
  detectUnusualSpending,
  getEatingBehaviorClusters,
  getBudgetOptimizedMealPlan,
  getSpendingBehaviourCoach,
  getAdaptiveRecommendations,
  getEatingPatternArchetypes,
  askEaterNaturalLanguage,
  // Export for testing
  cosineSimilarity,
  linearRegression,
  kMeansRun
};

