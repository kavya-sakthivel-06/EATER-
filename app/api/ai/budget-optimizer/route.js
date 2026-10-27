import { NextResponse } from 'next/server';
const { getDb } = require('../../../../lib/db');
const { getBudgetOptimizedMealPlan } = require('../../../../lib/ai');

const DEMO_USER_ID = 1;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const budget = Number(searchParams.get('budget')) || 120;
    const proteinGoal = Number(searchParams.get('proteinGoal')) || 25;
    const calorieGoal = searchParams.get('calorieGoal') ? Number(searchParams.get('calorieGoal')) : null;
    const category = searchParams.get('category') || null;
    const canteen = searchParams.get('canteen') || null;
    const vegetarian = searchParams.get('vegetarian') || null;
    const maxItems = Number(searchParams.get('maxItems')) || 6;

    const db = getDb();
    const result = getBudgetOptimizedMealPlan(db, DEMO_USER_ID, {
      budget,
      proteinGoal,
      calorieGoal,
      category,
      canteen,
      vegetarian,
      maxItems
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in budget optimizer GET:', error);
    return NextResponse.json({ error: 'Failed to compute budget optimizer' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const budget = Number(body.budget) || 120;
    const proteinGoal = Number(body.proteinGoal) || 25;
    const calorieGoal = body.calorieGoal ? Number(body.calorieGoal) : null;
    const category = body.category || null;
    const canteen = body.canteen || null;
    const vegetarian = body.vegetarian || null;
    const maxItems = Number(body.maxItems) || 6;

    const db = getDb();
    const result = getBudgetOptimizedMealPlan(db, DEMO_USER_ID, {
      budget,
      proteinGoal,
      calorieGoal,
      category,
      canteen,
      vegetarian,
      maxItems
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in budget optimizer POST:', error);
    return NextResponse.json({ error: 'Failed to compute budget optimizer' }, { status: 500 });
  }
}
