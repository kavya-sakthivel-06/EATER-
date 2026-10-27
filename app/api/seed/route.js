import { NextResponse } from 'next/server';
const { runSeed } = require('../../../lib/seed');

export async function POST() {
  try {
    runSeed();
    return NextResponse.json({ success: true, message: 'Database seeded successfully' });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json({ error: 'Failed to seed database: ' + error.message }, { status: 500 });
  }
}
