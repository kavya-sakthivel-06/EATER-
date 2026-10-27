import { NextResponse } from 'next/server';
const { getDb } = require('../../../../lib/db');
const { detectUnusualSpending } = require('../../../../lib/ai');

const DEMO_USER_ID = 1;

export async function GET() {
  try {
    const db = getDb();
    const result = detectUnusualSpending(db, DEMO_USER_ID);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error detecting unusual spending:', error);
    return NextResponse.json({ error: 'Failed to detect unusual spending' }, { status: 500 });
  }
}
