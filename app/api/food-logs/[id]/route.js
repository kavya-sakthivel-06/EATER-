import { NextResponse } from 'next/server';
const { getDb } = require('../../../../lib/db');

const DEMO_USER_ID = 1;

// PUT /api/food-logs/[id] - Update a food log
export async function PUT(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await request.json();
    const { quantity, logged_at } = body;

    // Verify ownership
    const existing = db.prepare('SELECT * FROM food_logs WHERE id = ? AND user_id = ?').get(id, DEMO_USER_ID);
    if (!existing) {
      return NextResponse.json({ error: 'Food log not found' }, { status: 404 });
    }

    if (quantity !== undefined && quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be positive' }, { status: 400 });
    }

    // Recalculate snapshots if quantity changed
    if (quantity !== undefined && quantity !== existing.quantity) {
      const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(existing.food_db_id);
      if (food) {
        db.prepare(`
          UPDATE food_logs SET 
            quantity = ?, 
            price_snapshot = ?,
            calories_snapshot = ?,
            protein_snapshot = ?,
            carbs_snapshot = ?,
            fat_snapshot = ?,
            logged_at = COALESCE(?, logged_at)
          WHERE id = ? AND user_id = ?
        `).run(
          quantity,
          food.price_inr * quantity,
          food.calories_kcal ? food.calories_kcal * quantity : null,
          food.protein_g ? food.protein_g * quantity : null,
          food.carbs_g ? food.carbs_g * quantity : null,
          food.fat_g ? food.fat_g * quantity : null,
          logged_at || null,
          id,
          DEMO_USER_ID
        );
      }
    } else if (logged_at) {
      db.prepare('UPDATE food_logs SET logged_at = ? WHERE id = ? AND user_id = ?').run(logged_at, id, DEMO_USER_ID);
    }

    const updated = db.prepare('SELECT * FROM food_logs WHERE id = ?').get(id);
    return NextResponse.json({ log: updated });
  } catch (error) {
    console.error('Error updating food log:', error);
    return NextResponse.json({ error: 'Failed to update food log' }, { status: 500 });
  }
}

// DELETE /api/food-logs/[id] - Delete a food log
export async function DELETE(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;

    const existing = db.prepare('SELECT * FROM food_logs WHERE id = ? AND user_id = ?').get(id, DEMO_USER_ID);
    if (!existing) {
      return NextResponse.json({ error: 'Food log not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM food_logs WHERE id = ? AND user_id = ?').run(id, DEMO_USER_ID);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting food log:', error);
    return NextResponse.json({ error: 'Failed to delete food log' }, { status: 500 });
  }
}
