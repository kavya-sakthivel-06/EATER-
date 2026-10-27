import { NextResponse } from 'next/server';
const { getDb } = require('../../../../lib/db');
const { getAdaptiveRecommendations } = require('../../../../lib/ai');

const DEMO_USER_ID = 1;

export async function GET(request) {
  try {
    const db = getDb();
    const result = getAdaptiveRecommendations(db, DEMO_USER_ID);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in adaptive recommendations:', error);
    return NextResponse.json({ error: 'Failed to compute adaptive recommendations' }, { status: 500 });
  }
}
