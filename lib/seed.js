const { getDb } = require('./db');
const menuData = require('../data/menu_data.json');

// Estimated nutrition for some common items (marked as estimated)
// These are rough estimates for demo purposes
const NUTRITION_ESTIMATES = {
  'Idly 2 pcs': { calories: 150, protein: 4, carbs: 30, fat: 1, serving: '2 pieces', veg: 'Yes' },
  'Dosa': { calories: 170, protein: 4, carbs: 28, fat: 5, serving: '1 piece', veg: 'Yes' },
  'Masala Dosa': { calories: 250, protein: 6, carbs: 35, fat: 10, serving: '1 piece', veg: 'Yes' },
  'Pongal': { calories: 200, protein: 5, carbs: 30, fat: 7, serving: '1 plate', veg: 'Yes' },
  'Poori 2 pcs': { calories: 300, protein: 6, carbs: 40, fat: 14, serving: '2 pieces', veg: 'Yes' },
  'Veg Meals': { calories: 550, protein: 15, carbs: 80, fat: 18, serving: '1 meal', veg: 'Yes' },
  'Non Veg Meals': { calories: 650, protein: 30, carbs: 75, fat: 22, serving: '1 meal', veg: 'No' },
  'Chicken Fried Rice': { calories: 450, protein: 20, carbs: 55, fat: 15, serving: '1 plate', veg: 'No' },
  'Veg Fried Rice': { calories: 350, protein: 8, carbs: 55, fat: 10, serving: '1 plate', veg: 'Yes' },
  'Egg Fried Rice': { calories: 400, protein: 14, carbs: 55, fat: 12, serving: '1 plate', veg: 'No' },
  'White Sauce Pasta': { calories: 420, protein: 12, carbs: 55, fat: 18, serving: '1 plate', veg: 'Yes' },
  'Red Sauce Pasta': { calories: 380, protein: 10, carbs: 52, fat: 14, serving: '1 plate', veg: 'Yes' },
  'Veg Burger': { calories: 350, protein: 10, carbs: 42, fat: 16, serving: '1 piece', veg: 'Yes' },
  'Chicken Burger': { calories: 450, protein: 22, carbs: 40, fat: 20, serving: '1 piece', veg: 'No' },
  'Veg Sandwich': { calories: 280, protein: 8, carbs: 35, fat: 12, serving: '1 piece', veg: 'Yes' },
  'Veg Noodles': { calories: 320, protein: 7, carbs: 48, fat: 10, serving: '1 plate', veg: 'Yes' },
  'Chicken Noodles': { calories: 420, protein: 18, carbs: 48, fat: 14, serving: '1 plate', veg: 'No' },
  'Egg Noodles': { calories: 370, protein: 12, carbs: 48, fat: 12, serving: '1 plate', veg: 'No' },
  'Tea': { calories: 60, protein: 1, carbs: 10, fat: 2, serving: '1 cup', veg: 'Yes' },
  'Coffee': { calories: 80, protein: 2, carbs: 12, fat: 3, serving: '1 cup', veg: 'Yes' },
  'Bhel Poori': { calories: 200, protein: 5, carbs: 30, fat: 8, serving: '1 plate', veg: 'Yes' },
  'Pani Poori': { calories: 180, protein: 4, carbs: 28, fat: 6, serving: '1 plate', veg: 'Yes' },
  'Vada Pav': { calories: 290, protein: 6, carbs: 38, fat: 12, serving: '1 piece', veg: 'Yes' },
  'Pav Bhaji': { calories: 380, protein: 10, carbs: 48, fat: 16, serving: '1 plate', veg: 'Yes' },
  'Samosa': { calories: 260, protein: 5, carbs: 30, fat: 14, serving: '2 pieces', veg: 'Yes' },
  'Veg Samosa 2 pcs': { calories: 260, protein: 5, carbs: 30, fat: 14, serving: '2 pieces', veg: 'Yes' },
  'Sweet Corn': { calories: 130, protein: 4, carbs: 22, fat: 3, serving: '1 cup', veg: 'Yes' },
  'Watermelon': { calories: 60, protein: 1, carbs: 15, fat: 0, serving: '1 bowl', veg: 'Yes' },
  'Mixed Cut Fruits': { calories: 90, protein: 1, carbs: 22, fat: 0, serving: '1 bowl', veg: 'Yes' },
  'Veg Puff': { calories: 180, protein: 3, carbs: 22, fat: 9, serving: '1 piece', veg: 'Yes' },
  'Egg Puff': { calories: 210, protein: 6, carbs: 22, fat: 11, serving: '1 piece', veg: 'No' },
  'Chicken Puff': { calories: 240, protein: 8, carbs: 22, fat: 13, serving: '1 piece', veg: 'No' },
  'Veg Momos': { calories: 220, protein: 6, carbs: 30, fat: 8, serving: '6 pieces', veg: 'Yes' },
  'Chicken Momos': { calories: 280, protein: 14, carbs: 28, fat: 10, serving: '6 pieces', veg: 'No' },
  'Chapati 2 pcs': { calories: 200, protein: 6, carbs: 34, fat: 5, serving: '2 pieces', veg: 'Yes' },
  'Parotta 2 pcs': { calories: 320, protein: 6, carbs: 42, fat: 14, serving: '2 pieces', veg: 'Yes' },
  'Chicken Shawarma': { calories: 380, protein: 20, carbs: 35, fat: 16, serving: '1 roll', veg: 'No' },
  'Paneer Shawarma': { calories: 350, protein: 14, carbs: 35, fat: 16, serving: '1 roll', veg: 'Yes' },
};

function seedMenuData() {
  const db = getDb();

  const insertFood = db.prepare(`
    INSERT OR IGNORE INTO foods (food_id, canteen, category, food_name, price_inr, 
      serving_description, calories_kcal, protein_g, carbs_g, fat_g, vegetarian, 
      nutrition_status, source_notes, last_verified)
    VALUES (@food_id, @canteen, @category, @food_name, @price_inr, 
      @serving_description, @calories_kcal, @protein_g, @carbs_g, @fat_g, @vegetarian, 
      @nutrition_status, @source_notes, @last_verified)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      // Check if we have estimated nutrition for this item
      const estimate = NUTRITION_ESTIMATES[item.food_name];
      
      insertFood.run({
        food_id: item.food_id,
        canteen: item.canteen,
        category: item.category,
        food_name: item.food_name,
        price_inr: item.price_inr,
        serving_description: estimate ? estimate.serving : (item.serving_description || null),
        calories_kcal: estimate ? estimate.calories : (item.calories_kcal || null),
        protein_g: estimate ? estimate.protein : (item.protein_g || null),
        carbs_g: estimate ? estimate.carbs : (item.carbs_g || null),
        fat_g: estimate ? estimate.fat : (item.fat_g || null),
        vegetarian: estimate ? estimate.veg : (item.vegetarian || 'Unknown'),
        nutrition_status: estimate ? 'Estimated' : (item.nutrition_status || 'Not entered'),
        source_notes: estimate 
          ? 'Estimated for demo purposes; not lab-verified. Source: common nutrition databases.'
          : (item.source_notes || 'Price transcribed from user-provided menu; nutrition not supplied.'),
        last_verified: null
      });
    }
  });

  insertMany(menuData);
  console.log(`✅ Imported ${menuData.length} menu items`);
}

function seedDemoUsers() {
  const db = getDb();

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, daily_calorie_target, daily_protein_target, monthly_budget)
    VALUES (@id, @name, @email, @daily_calorie_target, @daily_protein_target, @monthly_budget)
  `);

  const users = [
    { id: 1, name: 'Kavya', email: 'kavya@demo.com', daily_calorie_target: 2000, daily_protein_target: 60, monthly_budget: 6000 },
    { id: 2, name: 'Arun', email: 'arun@demo.com', daily_calorie_target: 2500, daily_protein_target: 80, monthly_budget: 5000 },
    { id: 3, name: 'Priya', email: 'priya@demo.com', daily_calorie_target: 1800, daily_protein_target: 50, monthly_budget: 4500 },
  ];

  for (const u of users) {
    insertUser.run(u);
  }
  console.log('✅ Created demo users');
}

function seedDemoFoodLogs() {
  const db = getDb();
  
  // Check if we already have logs
  const count = db.prepare('SELECT COUNT(*) as cnt FROM food_logs').get();
  if (count.cnt > 0) {
    console.log(`⏭️  Skipping food log seed — ${count.cnt} logs already exist`);
    return;
  }

  // Get foods that have nutrition data for more realistic logs
  const foodsWithNutrition = db.prepare(`
    SELECT id, food_id, canteen, food_name, price_inr, calories_kcal, protein_g, carbs_g, fat_g
    FROM foods WHERE nutrition_status = 'Estimated'
  `).all();

  const allFoods = db.prepare(`
    SELECT id, food_id, canteen, food_name, price_inr, calories_kcal, protein_g, carbs_g, fat_g
    FROM foods
  `).all();

  if (foodsWithNutrition.length === 0 && allFoods.length === 0) {
    console.log('⏭️  No foods found, skipping log seed');
    return;
  }

  const insertLog = db.prepare(`
    INSERT INTO food_logs (user_id, food_db_id, quantity, logged_at, price_snapshot, 
      calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot, 
      food_name_snapshot, canteen_snapshot, source)
    VALUES (@user_id, @food_db_id, @quantity, @logged_at, @price_snapshot, 
      @calories_snapshot, @protein_snapshot, @carbs_snapshot, @fat_snapshot, 
      @food_name_snapshot, @canteen_snapshot, @source)
  `);

  // Seeded random for reproducibility
  function seededRandom(seed) {
    let s = seed;
    return function() {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  const rand = seededRandom(42);
  const pickRandom = (arr) => arr[Math.floor(rand() * arr.length)];

  const insertLogs = db.transaction(() => {
    const users = [1, 2, 3];
    
    // Generate 45 days of history
    const today = new Date();
    
    for (const userId of users) {
      for (let dayOffset = 44; dayOffset >= 0; dayOffset--) {
        const date = new Date(today);
        date.setDate(date.getDate() - dayOffset);
        const dateStr = date.toISOString().split('T')[0];
        
        // 2-5 meals per day
        const mealsToday = 2 + Math.floor(rand() * 4);
        
        for (let meal = 0; meal < mealsToday; meal++) {
          // Prefer foods with nutrition, but mix in some without
          const useFoodsWithNutrition = rand() < 0.7 && foodsWithNutrition.length > 0;
          const food = useFoodsWithNutrition 
            ? pickRandom(foodsWithNutrition) 
            : pickRandom(allFoods);
          
          // Random meal times
          const hours = [8, 9, 12, 13, 14, 17, 18, 19, 20];
          const hour = pickRandom(hours);
          const minute = Math.floor(rand() * 60);
          const loggedAt = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
          
          const quantity = rand() < 0.8 ? 1 : 2;
          
          insertLog.run({
            user_id: userId,
            food_db_id: food.id,
            quantity: quantity,
            logged_at: loggedAt,
            price_snapshot: food.price_inr * quantity,
            calories_snapshot: food.calories_kcal ? food.calories_kcal * quantity : null,
            protein_snapshot: food.protein_g ? food.protein_g * quantity : null,
            carbs_snapshot: food.carbs_g ? food.carbs_g * quantity : null,
            fat_snapshot: food.fat_g ? food.fat_g * quantity : null,
            food_name_snapshot: food.food_name,
            canteen_snapshot: food.canteen,
            source: 'manual'
          });
        }
      }
    }
  });

  insertLogs();
  const finalCount = db.prepare('SELECT COUNT(*) as cnt FROM food_logs').get();
  console.log(`✅ Seeded ${finalCount.cnt} demo food logs across 3 users over 45 days`);
}

function runSeed() {
  console.log('🌱 Starting database seed...\n');
  seedMenuData();
  seedDemoUsers();
  seedDemoFoodLogs();
  console.log('\n✅ Seed complete!');
  
  // Report
  const db = getDb();
  const foodCount = db.prepare('SELECT COUNT(*) as cnt FROM foods').get();
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  const logCount = db.prepare('SELECT COUNT(*) as cnt FROM food_logs').get();
  const nutritionCount = db.prepare("SELECT COUNT(*) as cnt FROM foods WHERE nutrition_status = 'Estimated'").get();
  console.log(`\n📊 Database summary:`);
  console.log(`   Foods: ${foodCount.cnt} (${nutritionCount.cnt} with estimated nutrition)`);
  console.log(`   Users: ${userCount.cnt}`);
  console.log(`   Food logs: ${logCount.cnt}`);
}

module.exports = { runSeed, seedMenuData, seedDemoUsers, seedDemoFoodLogs };

// Run if called directly
if (require.main === module) {
  runSeed();
}
