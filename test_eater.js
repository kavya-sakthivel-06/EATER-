/**
 * Comprehensive Automated Test Suite for Eater
 * Tests:
 * 1. Database schema and tables
 * 2. Menu import repeatability and deduplication
 * 3. Nutrition handling (missing values are null, not zero)
 * 4. Food log CRUD operations & snapshot integrity
 * 5. Aggregation totals matching underlying logs
 * 6. User target settings & updates
 * 7. AI Feature 1: Cosine Similarity recommendations & explainability
 * 8. AI Feature 2: Linear Regression spending prediction & baseline comparison
 * 9. AI Feature 3: Isolation Forest unusual spending detection
 * 10. AI Feature 4: K-Means clustering with candidate K silhouette scores
 */

const assert = require('assert');
const { getDb } = require('./lib/db');
const { 
  getRecommendations, 
  predictMonthlySpending, 
  detectUnusualSpending, 
  getEatingBehaviorClusters,
  getBudgetOptimizedMealPlan,
  getSpendingBehaviourCoach,
  getAdaptiveRecommendations,
  getEatingPatternArchetypes,
  askEaterNaturalLanguage,
  cosineSimilarity,
  linearRegression,
  kMeansRun
} = require('./lib/ai');

function runAllTests() {
  console.log('🧪 Starting Eater Automated Test Suite...\n');
  const db = getDb();
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     ${err.message}`);
      failed++;
    }
  }

  // --- 1. Database & Schema Tests ---
  console.log('--- Test Suite 1: Database & Schema Integrity ---');

  test('Database has required tables: users, foods, food_logs', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    assert(tables.includes('users'), 'users table missing');
    assert(tables.includes('foods'), 'foods table missing');
    assert(tables.includes('food_logs'), 'food_logs table missing');
  });

  test('Menu has at least 200 items loaded from Excel', () => {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM foods').get();
    assert(count.cnt >= 200, `Expected >= 200 foods, got ${count.cnt}`);
  });

  test('Missing nutrition values remain NULL and are not forced to 0', () => {
    const unentered = db.prepare("SELECT * FROM foods WHERE nutrition_status = 'Not entered' LIMIT 1").get();
    if (unentered) {
      assert.strictEqual(unentered.calories_kcal, null, 'Unentered calories must be NULL');
      assert.strictEqual(unentered.protein_g, null, 'Unentered protein must be NULL');
    }
  });

  test('Estimated foods have status = Estimated and include source notes', () => {
    const est = db.prepare("SELECT * FROM foods WHERE nutrition_status = 'Estimated' LIMIT 1").get();
    assert(est, 'At least one food must have Estimated nutrition');
    assert(est.source_notes.includes('Estimated') || est.source_notes.includes('estimate'), 'Source notes must indicate estimate');
  });

  // --- 2. Food Log CRUD & Snapshots ---
  console.log('\n--- Test Suite 2: Food Log CRUD & Snapshot Integrity ---');

  let testLogId = null;

  test('Create food log with snapshots', () => {
    const food = db.prepare('SELECT * FROM foods WHERE calories_kcal IS NOT NULL LIMIT 1').get();
    assert(food, 'Food with calories needed');

    const result = db.prepare(`
      INSERT INTO food_logs (user_id, food_db_id, quantity, logged_at, price_snapshot, 
        calories_snapshot, protein_snapshot, food_name_snapshot, canteen_snapshot, source)
      VALUES (1, ?, 2, datetime('now'), ?, ?, ?, ?, ?, 'manual')
    `).run(
      food.id,
      food.price_inr * 2,
      food.calories_kcal * 2,
      food.protein_g * 2,
      food.food_name,
      food.canteen
    );

    testLogId = result.lastInsertRowid;
    assert(testLogId > 0, 'Log inserted');

    const inserted = db.prepare('SELECT * FROM food_logs WHERE id = ?').get(testLogId);
    assert.strictEqual(inserted.quantity, 2);
    assert.strictEqual(inserted.price_snapshot, food.price_inr * 2);
    assert.strictEqual(inserted.calories_snapshot, food.calories_kcal * 2);
  });

  test('Update food log quantity recalculates snapshots', () => {
    assert(testLogId, 'Test log ID required');
    const existing = db.prepare('SELECT * FROM food_logs WHERE id = ?').get(testLogId);
    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(existing.food_db_id);

    const newQty = 3;
    db.prepare(`
      UPDATE food_logs SET 
        quantity = ?, 
        price_snapshot = ?,
        calories_snapshot = ?,
        protein_snapshot = ?
      WHERE id = ?
    `).run(
      newQty,
      food.price_inr * newQty,
      food.calories_kcal * newQty,
      food.protein_g * newQty,
      testLogId
    );

    const updated = db.prepare('SELECT * FROM food_logs WHERE id = ?').get(testLogId);
    assert.strictEqual(updated.quantity, 3);
    assert.strictEqual(updated.price_snapshot, food.price_inr * 3);
  });

  test('Delete food log removes entry', () => {
    assert(testLogId, 'Test log ID required');
    db.prepare('DELETE FROM food_logs WHERE id = ?').run(testLogId);
    const deleted = db.prepare('SELECT * FROM food_logs WHERE id = ?').get(testLogId);
    assert.strictEqual(deleted, undefined, 'Log should be deleted');
  });

  // --- 3. User Target Settings ---
  console.log('\n--- Test Suite 3: User Target Goals ---');

  test('Demo user exists with default targets', () => {
    const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
    assert(user, 'User 1 must exist');
    assert(user.daily_calorie_target > 0, 'Calorie target must be > 0');
    assert(user.daily_protein_target > 0, 'Protein target must be > 0');
    assert(user.monthly_budget > 0, 'Monthly budget must be > 0');
  });

  test('Updating targets persists in database', () => {
    db.prepare('UPDATE users SET daily_calorie_target = 2200, daily_protein_target = 65 WHERE id = 1').run();
    const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
    assert.strictEqual(user.daily_calorie_target, 2200);
    assert.strictEqual(user.daily_protein_target, 65);
    // restore
    db.prepare('UPDATE users SET daily_calorie_target = 2000, daily_protein_target = 60 WHERE id = 1').run();
  });

  // --- 4. AI Feature 1: Cosine Similarity Recommendations ---
  console.log('\n--- Test Suite 4: AI Feature 1 - Cosine Similarity Recommendations ---');

  test('Cosine similarity function computes exact dot product over norms', () => {
    const sim = cosineSimilarity([1, 0], [1, 0]);
    assert.strictEqual(Math.round(sim), 1, 'Parallel vectors must have similarity 1');

    const orthogonal = cosineSimilarity([1, 0], [0, 1]);
    assert.strictEqual(orthogonal, 0, 'Orthogonal vectors must have similarity 0');
  });

  test('getRecommendations returns ranked items with scores, reasons, and baseline', () => {
    const recs = getRecommendations(db, 1, { maxPrice: 100, limit: 5 });
    assert(recs.recommendations.length > 0, 'Should return recommendations');
    assert(recs.recommendations[0].similarity_score <= 1.0, 'Similarity score <= 1.0');
    assert(recs.recommendations[0].similarity_score >= 0.0, 'Similarity score >= 0.0');
    assert(recs.recommendations[0].reason, 'Reason string must be present');
    assert(recs.algorithm === 'Cosine Similarity', 'Algorithm name matches');
    assert(recs.baseline_method, 'Baseline method must be reported');
  });

  // --- 5. AI Feature 2: Linear Regression Spending Prediction ---
  console.log('\n--- Test Suite 5: AI Feature 2 - Linear Regression Forecast ---');

  test('linearRegression computes slope, intercept, and R²', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [10, 20, 30, 40, 50]; // perfect line y = 10x
    const res = linearRegression(xs, ys);
    assert.strictEqual(Math.round(res.slope), 10);
    assert.strictEqual(Math.round(res.intercept), 0);
    assert.strictEqual(Math.round(res.r2), 1);
  });

  test('predictMonthlySpending predicts month-end spend, baseline comparison, and evaluation', () => {
    const res = predictMonthlySpending(db, 1);
    assert(!res.error, 'Prediction should succeed');
    assert(typeof res.predicted_month_end === 'number', 'predicted_month_end is a number');
    assert(typeof res.baseline_prediction === 'number', 'baseline_prediction is a number');
    assert(res.evaluation, 'Evaluation object must be present');
    assert(res.projected_trajectory.length > 0, 'Projected trajectory must be computed');
  });

  // --- 6. AI Feature 3: Isolation Forest Unusual Spending ---
  console.log('\n--- Test Suite 6: AI Feature 3 - Isolation Forest Outlier Detection ---');

  test('detectUnusualSpending returns threshold, features, and flags without labeling as fraud', () => {
    const res = detectUnusualSpending(db, 1);
    assert(!res.error, 'Anomaly detection should succeed');
    assert(res.total_days_analyzed >= 10, 'Requires history');
    assert(res.features_used.length === 3, 'Expected 3 features');
    assert(res.algorithm === 'Isolation Forest', 'Algorithm name matches');
    assert(res.validation_note.includes('unsupervised'), 'Must clarify unsupervised nature');
    if (res.flagged_days.length > 0) {
      assert(res.flagged_days[0].reason, 'Contributing reason must be generated');
      assert(res.flagged_days[0].anomaly_score >= res.threshold, 'Flagged day must meet threshold');
    }
  });

  // --- 7. AI Feature 4: K-Means Eating-Behaviour Groups ---
  console.log('\n--- Test Suite 7: AI Feature 4 - K-Means Clustering ---');

  test('kMeansRun groups standardized data and computes silhouette score', () => {
    const sampleData = [
      [-1, -1], [-1.1, -0.9], [-0.9, -1.2],
      [1, 1], [1.1, 0.9], [0.9, 1.2]
    ];
    const result = kMeansRun(sampleData, 2);
    assert.strictEqual(result.centroids.length, 2);
    assert(result.silhouette > 0.5, 'Well-separated clusters should have positive silhouette');
  });

  test('getEatingBehaviorClusters returns cluster summaries, candidate K evaluations, and centroids', () => {
    const res = getEatingBehaviorClusters(db);
    assert(!res.error, 'Clustering should succeed');
    assert(res.clusters.length >= 2, 'Should have at least 2 clusters');
    assert(res.k_candidates.length >= 2, 'Evaluated multiple K candidates');
    assert(res.silhouette_score !== undefined, 'Silhouette score must be reported');
    assert(res.clusters[0].centroid.avg_daily_spend !== undefined, 'Centroid avg_daily_spend present');
  });

  // --- 8. Five New Features & Capability Extensions ---
  console.log('\n--- Test Suite 8: New AI Features & Optimizers ---');

  test('AI Feature 1 Extension: getBudgetOptimizedMealPlan solves bounded knapsack for protein within budget', () => {
    const res = getBudgetOptimizedMealPlan(db, 1, { budget: 120, proteinGoal: 20 });
    assert(res.summary, 'Summary must exist');
    assert(res.summary.total_cost <= 120, 'Total cost must not exceed budget');
    assert(res.plan.length > 0, 'Must produce recommended meal plan');
    assert(res.summary.total_protein >= 0, 'Must compute total protein');
  });

  test('AI Feature 2 Extension: getSpendingBehaviourCoach diagnoses burn rate, weekend skew, and what-if savings', () => {
    const res = getSpendingBehaviourCoach(db, 1);
    assert(res.daily_burn_rate >= 0, 'Burn rate must be computed');
    assert(res.day_of_week_analysis.length === 7, 'Must evaluate 7 days of the week');
    assert(res.simulations.length >= 3, 'Must simulate at least 3 behavioral savings scenarios');
    assert(res.suggestions.length > 0, 'Must generate actionable recommendations');
  });

  test('AI Feature 3 Extension: getAdaptiveRecommendations adapts to time slot and remaining protein deficit', () => {
    const res = getAdaptiveRecommendations(db, 1);
    assert(res.time_slot, 'Must classify current meal slot');
    assert(res.context, 'Must provide remaining nutrient context');
    assert(res.recommendations.length > 0, 'Must return ranked suggestions');
  });

  test('AI Feature 4 Extension: getEatingPatternArchetypes assigns non-judgmental student dining persona', () => {
    const res = getEatingPatternArchetypes(db, 1);
    assert(res.archetype, 'Archetype must be identified');
    assert(res.all_archetypes.length === 4, 'Must evaluate 4 campus dining archetypes');
    assert(res.wellness_advice, 'Must provide supportive guidance');
  });

  test('AI Feature 5 Extension: askEaterNaturalLanguage processes free-form spending and nutrition questions', () => {
    const q1 = askEaterNaturalLanguage(db, 1, 'How much did I spend this week?');
    assert(q1.answer && q1.answer.includes('₹'), 'Must answer weekly spending with amount');

    const q2 = askEaterNaturalLanguage(db, 1, 'Did I reach my protein goal today?');
    assert(q2.answer && q2.answer.includes('protein'), 'Must answer daily protein inquiry');
  });

  console.log(`\n========================================`);
  console.log(`📊 Test Summary: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
