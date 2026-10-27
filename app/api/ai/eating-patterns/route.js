import { NextResponse } from 'next/server';
const { getDb } = require('../../../../lib/db');
const { getEatingPatternArchetypes } = require('../../../../lib/ai');

const DEMO_USER_ID = 1;

export async function GET() {
  try {
    const db = getDb();
    const result = getEatingPatternArchetypes(db, DEMO_USER_ID);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in eating patterns API:', error);
    return NextResponse.json({ error: 'Failed to compute eating pattern archetypes' }, { status: 500 });
  }
}
