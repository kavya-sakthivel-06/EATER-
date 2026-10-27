import { NextResponse } from 'next/server';
const { getDb } = require('../../../../lib/db');
const { predictMonthlySpending } = require('../../../../lib/ai');

const DEMO_USER_ID = 1;

export async function GET() {
  try {
    const db = getDb();
    const result = predictMonthlySpending(db, DEMO_USER_ID);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error predicting spending:', error);
    return NextResponse.json({ error: 'Failed to predict spending' }, { status: 500 });
  }
}
