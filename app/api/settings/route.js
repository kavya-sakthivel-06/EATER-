import { NextResponse } from 'next/server';
const { getDb } = require('../../../lib/db');

const DEMO_USER_ID = 1;

// GET /api/settings - Get user settings
export async function GET() {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(DEMO_USER_ID);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ 
      settings: {
        name: user.name,
        email: user.email,
        daily_calorie_target: user.daily_calorie_target,
        daily_protein_target: user.daily_protein_target,
        monthly_budget: user.monthly_budget,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/settings - Update user settings
export async function PUT(request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { daily_calorie_target, daily_protein_target, monthly_budget, name } = body;

    if (daily_calorie_target !== undefined && (daily_calorie_target < 500 || daily_calorie_target > 10000)) {
      return NextResponse.json({ error: 'Calorie target must be between 500 and 10000 kcal' }, { status: 400 });
    }
    if (daily_protein_target !== undefined && (daily_protein_target < 10 || daily_protein_target > 500)) {
      return NextResponse.json({ error: 'Protein target must be between 10 and 500 g' }, { status: 400 });
    }
    if (monthly_budget !== undefined && (monthly_budget < 500 || monthly_budget > 50000)) {
      return NextResponse.json({ error: 'Monthly budget must be between ₹500 and ₹50,000' }, { status: 400 });
    }

    db.prepare(`
      UPDATE users SET 
        daily_calorie_target = COALESCE(?, daily_calorie_target),
        daily_protein_target = COALESCE(?, daily_protein_target),
        monthly_budget = COALESCE(?, monthly_budget),
        name = COALESCE(?, name)
      WHERE id = ?
    `).run(daily_calorie_target || null, daily_protein_target || null, monthly_budget || null, name || null, DEMO_USER_ID);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(DEMO_USER_ID);
    return NextResponse.json({ 
      settings: {
        name: user.name,
        email: user.email,
        daily_calorie_target: user.daily_calorie_target,
        daily_protein_target: user.daily_protein_target,
        monthly_budget: user.monthly_budget,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
