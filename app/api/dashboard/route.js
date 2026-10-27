import { NextResponse } from 'next/server';
const { getDb } = require('../../../lib/db');

const DEMO_USER_ID = 1;

// GET /api/dashboard - Get dashboard data
export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'today';

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(DEMO_USER_ID);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Today's data
    const todayStats = db.prepare(`
      SELECT 
        COALESCE(SUM(price_snapshot), 0) as total_spending,
        SUM(calories_snapshot) as total_calories,
        SUM(protein_snapshot) as total_protein,
        SUM(carbs_snapshot) as total_carbs,
        SUM(fat_snapshot) as total_fat,
        COUNT(*) as items_logged,
        COUNT(CASE WHEN calories_snapshot IS NOT NULL THEN 1 END) as items_with_nutrition
      FROM food_logs 
      WHERE user_id = ? AND DATE(logged_at) = DATE('now', 'localtime')
    `).get(DEMO_USER_ID);

    // This month's spending
    const monthStats = db.prepare(`
      SELECT COALESCE(SUM(price_snapshot), 0) as monthly_spending
      FROM food_logs 
      WHERE user_id = ? AND strftime('%Y-%m', logged_at) = strftime('%Y-%m', 'now', 'localtime')
    `).get(DEMO_USER_ID);

    // Weekly data for charts (last 7 days)
    const weeklyData = db.prepare(`
      SELECT 
        DATE(logged_at) as date,
        COALESCE(SUM(price_snapshot), 0) as daily_spending,
        SUM(calories_snapshot) as daily_calories,
        SUM(protein_snapshot) as daily_protein,
        COUNT(*) as items_count
      FROM food_logs 
      WHERE user_id = ? AND logged_at >= datetime('now', '-7 days')
      GROUP BY DATE(logged_at)
      ORDER BY date
    `).all(DEMO_USER_ID);

    // Monthly spending by day (for chart)
    const monthlyDailyData = db.prepare(`
      SELECT 
        DATE(logged_at) as date,
        COALESCE(SUM(price_snapshot), 0) as daily_spending
      FROM food_logs 
      WHERE user_id = ? AND strftime('%Y-%m', logged_at) = strftime('%Y-%m', 'now', 'localtime')
      GROUP BY DATE(logged_at)
      ORDER BY date
    `).all(DEMO_USER_ID);

    // Recent food logs
    const recentLogs = db.prepare(`
      SELECT fl.*, f.nutrition_status
      FROM food_logs fl
      LEFT JOIN foods f ON fl.food_db_id = f.id
      WHERE fl.user_id = ?
      ORDER BY fl.logged_at DESC
      LIMIT 10
    `).all(DEMO_USER_ID);

    // Nutrition completeness
    const nutritionIncomplete = todayStats.items_logged > 0 && todayStats.items_with_nutrition < todayStats.items_logged;

    return NextResponse.json({
      user: {
        name: user.name,
        daily_calorie_target: user.daily_calorie_target,
        daily_protein_target: user.daily_protein_target,
        monthly_budget: user.monthly_budget,
      },
      today: {
        calories: todayStats.total_calories || 0,
        protein: todayStats.total_protein || 0,
        carbs: todayStats.total_carbs || 0,
        fat: todayStats.total_fat || 0,
        spending: todayStats.total_spending,
        items_logged: todayStats.items_logged,
        items_with_nutrition: todayStats.items_with_nutrition,
        nutrition_incomplete: nutritionIncomplete,
      },
      month: {
        spending: monthStats.monthly_spending,
        budget: user.monthly_budget,
        remaining: user.monthly_budget - monthStats.monthly_spending,
      },
      targets: {
        calories: {
          consumed: todayStats.total_calories || 0,
          target: user.daily_calorie_target,
          remaining: user.daily_calorie_target - (todayStats.total_calories || 0),
        },
        protein: {
          consumed: todayStats.total_protein || 0,
          target: user.daily_protein_target,
          remaining: user.daily_protein_target - (todayStats.total_protein || 0),
        },
      },
      weeklyData,
      monthlyDailyData,
      recentLogs,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
