/**
 * Safe, additive nutrition import for Eater.
 *
 * Run from the Next.js project root:
 *   node scripts/import-food-nutrition.js
 *
 * It updates ONLY nutrition columns + nutrition_status + source_notes,
 * matching by food_id. It never inserts/deletes foods or changes prices.
 * A timestamped SQLite backup is created before the transaction.
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.join(process.cwd(), "eater.db");
const DATA_PATH = path.join(__dirname, "..", "data", "food_nutrition_estimates.json");

const nutritionColumns = [
  "calories_kcal", "protein_g", "carbs_g", "fat_g", "sugar_g", "fiber_g",
  "nutrition_status", "source_notes"
];

function fail(message) {
  console.error(`\nIMPORT STOPPED: ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) fail(`Database not found at ${DB_PATH}. Run this from your project root.`);
if (!fs.existsSync(DATA_PATH)) fail(`Dataset not found at ${DATA_PATH}.`);

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
if (!Array.isArray(data) || data.length !== 200) fail(`Expected exactly 200 dataset rows; found ${data.length}.`);

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

try {
  const table = db.prepare("PRAGMA table_info(foods)").all();
  if (!table.length) fail("foods table does not exist.");
  const existingColumns = new Set(table.map(c => c.name));
  const required = ["food_id", ...nutritionColumns];
  const missing = required.filter(c => !existingColumns.has(c));
  if (missing.length) fail(`Missing foods columns: ${missing.join(", ")}. Add sugar_g and fiber_g migrations first.`);

  const ids = data.map(r => r.food_id);
  if (new Set(ids).size !== ids.length) fail("Dataset contains duplicate food_id values.");
  for (const row of data) {
    if (!row.food_id || !row.food_name) fail("A dataset row is missing food_id or food_name.");
    if (row.nutrition_status === "Estimated") {
      for (const col of ["calories_kcal", "protein_g", "carbs_g", "fat_g", "sugar_g", "fiber_g"]) {
        if (typeof row[col] !== "number" || !Number.isFinite(row[col]) || row[col] < 0) {
          fail(`${row.food_id} has invalid ${col}.`);
        }
      }
    }
  }

  const dbRows = db.prepare("SELECT food_id, food_name, price_inr FROM foods").all();
  const dbById = new Map(dbRows.map(r => [r.food_id, r]));
  const unmatched = data.filter(r => !dbById.has(r.food_id));
  if (unmatched.length) fail(`Dataset IDs missing from DB: ${unmatched.map(r => r.food_id).join(", ")}`);
  const nameMismatches = data.filter(r => dbById.get(r.food_id).food_name !== r.food_name);
  if (nameMismatches.length) {
    fail(`Food-name mismatch for ${nameMismatches.map(r => r.food_id).join(", ")}. Verify you're importing into the matching database.`);
  }

  const backupPath = `${DB_PATH}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(DB_PATH, backupPath);

  const update = db.prepare(`
    UPDATE foods
    SET calories_kcal = @calories_kcal,
        protein_g = @protein_g,
        carbs_g = @carbs_g,
        fat_g = @fat_g,
        sugar_g = @sugar_g,
        fiber_g = @fiber_g,
        nutrition_status = @nutrition_status,
        source_notes = @source_notes
    WHERE food_id = @food_id
  `);

  const importTransaction = db.transaction((records) => {
    let updated = 0;
    for (const row of records) updated += update.run(row).changes;
    return updated;
  });

  const updated = importTransaction(data);
  const report = db.prepare(`
    SELECT
      COUNT(*) AS total_foods,
      SUM(CASE WHEN calories_kcal IS NOT NULL THEN 1 ELSE 0 END) AS calories_filled,
      SUM(CASE WHEN nutrition_status = 'Estimated' THEN 1 ELSE 0 END) AS estimated_rows,
      SUM(CASE WHEN nutrition_status = 'Not applicable' THEN 1 ELSE 0 END) AS not_applicable_rows
    FROM foods
  `).get();

  console.log("\nNutrition import completed.");
  console.log({ updated_rows: updated, backup: backupPath, report });
  console.log("Prices and all non-nutrition food fields were not updated.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  db.close();
}
