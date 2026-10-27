import { NextResponse } from 'next/server';
const { getDb } = require('../../../../lib/db');
const { getSpendingBehaviourCoach } = require('../../../../lib/ai');

const DEMO_USER_ID = 1;

export async function GET() {
  try {
    const db = getDb();
    const result = getSpendingBehaviourCoach(db, DEMO_USER_ID);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in spending behaviour coach:', error);
    return NextResponse.json({ error: 'Failed to compute spending behaviour coach' }, { status: 500 });
  }
}
