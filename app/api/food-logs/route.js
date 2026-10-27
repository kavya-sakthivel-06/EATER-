import { NextResponse } from 'next/server';
const { getDb } = require('../../../lib/db');

const DEMO_USER_ID = 1;

// GET /api/food-logs - Get food logs with optional date filters
export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    
    const filter = searchParams.get('filter') || 'today';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let dateCondition = '';
    const params = [DEMO_USER_ID];

    switch (filter) {
      case 'today':
        dateCondition = "AND DATE(logged_at) = DATE('now', 'localtime')";
        break;
      case '7days':
        dateCondition = "AND logged_at >= datetime('now', '-7 days')";
        break;
      case 'month':
        dateCondition = "AND strftime('%Y-%m', logged_at) = strftime('%Y-%m', 'now')";
        break;
      case 'custom':
        if (startDate && endDate) {
          dateCondition = 'AND DATE(logged_at) >= ? AND DATE(logged_at) <= ?';
          params.push(startDate, endDate);
        }
        break;
      case 'all':
        dateCondition = '';
        break;
    }

    const logs = db.prepare(`
      SELECT fl.*, f.category, f.vegetarian, f.nutrition_status
      FROM food_logs fl
      LEFT JOIN foods f ON fl.food_db_id = f.id
      WHERE fl.user_id = ? ${dateCondition}
      ORDER BY fl.logged_at DESC
    `).all(...params);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching food logs:', error);
    return NextResponse.json({ error: 'Failed to fetch food logs' }, { status: 500 });
  }
}

// POST /api/food-logs - Create a new food log
export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { food_db_id, quantity, logged_at, source } = body;

    if (!food_db_id || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'food_db_id and valid quantity are required' }, { status: 400 });
    }

    // Get food data for snapshot
    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(food_db_id);
    if (!food) {
      return NextResponse.json({ error: 'Food not found' }, { status: 404 });
    }

    const result = db.prepare(`
      INSERT INTO food_logs (user_id, food_db_id, quantity, logged_at, 
        price_snapshot, calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot,
        food_name_snapshot, canteen_snapshot, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      DEMO_USER_ID,
      food_db_id,
      quantity,
      logged_at || new Date().toISOString(),
      food.price_inr * quantity,
      food.calories_kcal ? food.calories_kcal * quantity : null,
      food.protein_g ? food.protein_g * quantity : null,
      food.carbs_g ? food.carbs_g * quantity : null,
      food.fat_g ? food.fat_g * quantity : null,
      food.food_name,
      food.canteen,
      source || 'manual'
    );

    const newLog = db.prepare('SELECT * FROM food_logs WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ log: newLog }, { status: 201 });
  } catch (error) {
    console.error('Error creating food log:', error);
    return NextResponse.json({ error: 'Failed to create food log' }, { status: 500 });
  }
}
