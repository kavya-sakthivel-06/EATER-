import { NextResponse } from 'next/server';
const { getDb } = require('../../../../lib/db');
const { getEatingBehaviorClusters } = require('../../../../lib/ai');

export async function GET() {
  try {
    const db = getDb();
    const result = getEatingBehaviorClusters(db);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting behavior clusters:', error);
    return NextResponse.json({ error: 'Failed to get behavior clusters' }, { status: 500 });
  }
}
