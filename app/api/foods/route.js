
import { NextResponse } from 'next/server';
const { getDb } = require('../../../lib/db');

// Safely read nutrition values from different database column names.
function getValue(row, keys) {
  for (const key of keys) {
    const value = row[key];

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

// Standardize database fields for the frontend.
function normalizeFood(row) {
  return {
    ...row,

    id: row.id ?? row.food_id,

    food_name: row.food_name ?? row.name ?? 'Unknown food',

    canteen: row.canteen ?? row.outlet ?? 'Unknown outlet',

    price_inr: getValue(row, ['price_inr', 'price']),

    calories_kcal: getValue(row, [
      'calories_kcal',
      'calories',
      'calorie'
    ]),

    protein_g: getValue(row, [
      'protein_g',
      'protein'
    ]),

    carbs_g: getValue(row, [
      'carbs_g',
      'carbohydrates_g',
      'carbs'
    ]),

    fat_g: getValue(row, [
      'fat_g',
      'fat'
    ]),

    sugar_g: getValue(row, [
      'sugar_g',
      'sugar'
    ]),

    fiber_g: getValue(row, [
      'fiber_g',
      'fibre_g',
      'fiber',
      'fibre'
    ]),

    serving_description:
      row.serving_description ?? row.serving_size ?? null,

    nutrition_status:
      row.nutrition_status ?? 'Available'
  };
}

// GET /api/foods
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

    const validSortFields = [
      'food_name',
      'price_inr',
      'canteen',
      'category',
      'calories_kcal',
      'protein_g'
    ];

    const safeSortBy = validSortFields.includes(sortBy)
      ? sortBy
      : 'food_name';

    const safeSortOrder =
      sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    query += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;

    const rawFoods = db.prepare(query).all(...params);

    const foods = rawFoods.map(normalizeFood);

    const canteens = [
      ...new Set(foods.map(food => food.canteen).filter(Boolean))
    ];

    const categories = [
      ...new Set(foods.map(food => food.category).filter(Boolean))
    ];

    console.log('Food count:', foods.length);
    console.log('First normalized food:', foods[0]);

    return NextResponse.json({
      foods,
      canteens,
      categories
    });

  } catch (error) {
    console.error('Error fetching foods:', error);

    return NextResponse.json(
      { error: 'Failed to fetch foods' },
      { status: 500 }
    );
  }
}

// PUT /api/foods - Update nutrition data
export async function PUT(request) {
  try {
    const db = getDb();
    const body = await request.json();

    const {
      id,
      calories_kcal,
      protein_g,
      carbs_g,
      fat_g,
      serving_description,
      nutrition_status,
      source_notes,
      vegetarian
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Food ID is required' },
        { status: 400 }
      );
    }

    const result = db.prepare(`
      UPDATE foods SET
        calories_kcal = ?,
        protein_g = ?,
        carbs_g = ?,
        fat_g = ?,
        serving_description = ?,
        nutrition_status = ?,
        source_notes = ?,
        vegetarian = ?,
        updated_at = datetime('now'),
        last_verified = datetime('now')
      WHERE id = ?
    `).run(
      calories_kcal ?? null,
      protein_g ?? null,
      carbs_g ?? null,
      fat_g ?? null,
      serving_description ?? null,
      nutrition_status ?? 'Estimated',
      source_notes ?? null,
      vegetarian ?? 'Unknown',
      id
    );

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Food not found' },
        { status: 404 }
      );
    }

    const updated = db.prepare(
      'SELECT * FROM foods WHERE id = ?'
    ).get(id);

    return NextResponse.json({
      food: normalizeFood(updated)
    });

  } catch (error) {
    console.error('Error updating food:', error);

    return NextResponse.json(
      { error: 'Failed to update food' },
      { status: 500 }
    );
  }
}
