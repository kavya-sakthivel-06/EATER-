import { NextResponse } from 'next/server';
const { getDb } = require('../../../lib/db');
const { getRecommendations } = require('../../../lib/ai');

const DEMO_USER_ID = 1;

export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const options = {
      maxPrice: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')) : Infinity,
      proteinPriority: searchParams.get('proteinPriority') ? parseFloat(searchParams.get('proteinPriority')) : 0.5,
      caloriePriority: searchParams.get('caloriePriority') ? parseFloat(searchParams.get('caloriePriority')) : 0.5,
      category: searchParams.get('category') || null,
      canteen: searchParams.get('canteen') || null,
      limit: parseInt(searchParams.get('limit') || '20'),
      preferLowCalorie: searchParams.get('preferLowCalorie') === 'true',
    };

    const result = getRecommendations(db, DEMO_USER_ID, options);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return NextResponse.json({ error: 'Failed to get recommendations' }, { status: 500 });
  }
}
