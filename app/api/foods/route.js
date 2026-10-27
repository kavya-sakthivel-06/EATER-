import { NextResponse } from 'next/server';
const { getDb } = require('../../../lib/db');

// GET /api/foods - Get all foods with optional filters
export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search') || '';
    const canteen = searchParams.get('canteen') || '';
    const category = searchParams.get('category') || '';
    const vegetarian = searchParams.get('vegetarian') || '';
    const sortBy = searchParams.get('sortBy') || 'food_name';
    const sortOrder = searchParams.get('sortOrder') || 'ASC';

    let query = 'SELECT * FROM foods WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND food_name LIKE ?';
      params.push(`%${search}%`);
    }
    if (canteen) {
      query += ' AND canteen = ?';
      params.push(canteen);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (vegetarian && vegetarian !== 'Unknown') {
      query += ' AND vegetarian = ?';
      params.push(vegetarian);
    }

    const validSortFields = ['food_name', 'price_inr', 'canteen', 'category', 'calories_kcal', 'protein_g'];
    const validSortOrders = ['ASC', 'DESC'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'food_name';
    const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';
    query += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;

    const foods = db.prepare(query).all(...params);

    // Get distinct canteens and categories for filters
    const canteens = db.prepare('SELECT DISTINCT canteen FROM foods ORDER BY canteen').all().map(r => r.canteen);
    const categories = db.prepare('SELECT DISTINCT category FROM foods ORDER BY category').all().map(r => r.category);

    return NextResponse.json({ foods, canteens, categories });
  } catch (error) {
    console.error('Error fetching foods:', error);
    return NextResponse.json({ error: 'Failed to fetch foods' }, { status: 500 });
  }
}

// PUT /api/foods - Update food nutrition data
export async function PUT(request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, calories_kcal, protein_g, carbs_g, fat_g, serving_description, nutrition_status, source_notes, vegetarian } = body;

    if (!id) {
      return NextResponse.json({ error: 'Food ID is required' }, { status: 400 });
    }

    db.prepare(`
      UPDATE foods SET 
        calories_kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ?,
        serving_description = ?, nutrition_status = ?, source_notes = ?,
        vegetarian = ?, updated_at = datetime('now'), last_verified = datetime('now')
      WHERE id = ?
    `).run(
      calories_kcal || null, protein_g || null, carbs_g || null, fat_g || null,
      serving_description || null, nutrition_status || 'Estimated', source_notes || null,
      vegetarian || 'Unknown', id
    );

    const updated = db.prepare('SELECT * FROM foods WHERE id = ?').get(id);
    return NextResponse.json({ food: updated });
  } catch (error) {
    console.error('Error updating food:', error);
    return NextResponse.json({ error: 'Failed to update food' }, { status: 500 });
  }
}
