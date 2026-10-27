import { NextResponse } from 'next/server';
const { getDb } = require('../../../../lib/db');
const { askEaterNaturalLanguage } = require('../../../../lib/ai');

const DEMO_USER_ID = 1;

export async function POST(request) {
  try {
    const body = await request.json();
    const query = body.query || '';
    const db = getDb();
    const result = askEaterNaturalLanguage(db, DEMO_USER_ID, query);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in ask-eater route:', error);
    return NextResponse.json({ error: 'Failed to process natural language question' }, { status: 500 });
  }
}
