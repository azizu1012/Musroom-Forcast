import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../server/db.js';
import { purgeOldRecords, getRetentionStats } from '../server/retention.js';
import { sanitizeString, validateCoordinates } from '../server/security.js';

test('Security Sanitization and Coordinates Validation', () => {
  // Test coordinate validation
  assert.equal(validateCoordinates(21.0245, 105.84117).valid, true);
  assert.equal(validateCoordinates(120, 50).valid, false); // invalid lat
  assert.equal(validateCoordinates(20, -200).valid, false); // invalid lon
  assert.equal(validateCoordinates('abc', 10).valid, false);

  // Test string sanitization against XSS
  const dirty = '<script>alert("hack")</script>Hanoi City';
  const clean = sanitizeString(dirty);
  assert.equal(clean.includes('<'), false);
  assert.equal(clean.includes('>'), false);
  assert.equal(clean, 'scriptalert("hack")/scriptHanoi City');
});

test('SQLite Database CRUD operations for Locations', () => {
  // CREATE
  const insertStmt = db.prepare(`
    INSERT INTO locations (name, latitude, longitude, country, custom_label, notes, is_favorite)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const res = insertStmt.run('Testville', 10.5, 106.5, 'Testland', 'Vacation', 'Test note', 1);
  const newId = res.lastInsertRowid;
  assert.ok(newId > 0);

  // READ
  const readRow = db.prepare('SELECT * FROM locations WHERE id = ?').get(newId);
  assert.equal(readRow.name, 'Testville');
  assert.equal(readRow.custom_label, 'Vacation');
  assert.equal(readRow.is_favorite, 1);

  // UPDATE
  const updateStmt = db.prepare(`
    UPDATE locations SET custom_label = ?, notes = ?, alert_rain_threshold = ? WHERE id = ?
  `);
  updateStmt.run('Updated Label', 'Updated note content', 75, newId);
  const updatedRow = db.prepare('SELECT * FROM locations WHERE id = ?').get(newId);
  assert.equal(updatedRow.custom_label, 'Updated Label');
  assert.equal(updatedRow.notes, 'Updated note content');
  assert.equal(updatedRow.alert_rain_threshold, 75);

  // DELETE
  db.prepare('DELETE FROM locations WHERE id = ?').run(newId);
  const deletedRow = db.prepare('SELECT * FROM locations WHERE id = ?').get(newId);
  assert.equal(deletedRow, undefined);
});

test('3-Year Historical Retention Policy Engine', () => {
  // Insert a test snapshot from 4 years ago (should be purged)
  const fourYearsAgo = new Date();
  fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

  // Insert a test snapshot from 2 years ago (should be kept)
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const insertSnap = db.prepare(`
    INSERT INTO weather_snapshots (city_name, latitude, longitude, date, recorded_at, temperature)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const oldSnap = insertSnap.run('OldCity', 10, 10, '2022-01-01', fourYearsAgo.toISOString(), 20.0);
  const recentSnap = insertSnap.run('RecentCity', 10, 10, '2024-01-01', twoYearsAgo.toISOString(), 22.0);

  const oldId = oldSnap.lastInsertRowid;
  const recentId = recentSnap.lastInsertRowid;

  // Verify both exist before purge
  assert.ok(db.prepare('SELECT id FROM weather_snapshots WHERE id = ?').get(oldId));
  assert.ok(db.prepare('SELECT id FROM weather_snapshots WHERE id = ?').get(recentId));

  // Run the 3-year retention purge
  const purgeResult = purgeOldRecords();
  assert.equal(purgeResult.success, true);
  assert.ok(purgeResult.deletedCount >= 1);

  // Verify the 4-year-old record was purged
  assert.equal(db.prepare('SELECT id FROM weather_snapshots WHERE id = ?').get(oldId), undefined);

  // Verify the 2-year-old record is still safely retained!
  assert.ok(db.prepare('SELECT id FROM weather_snapshots WHERE id = ?').get(recentId));

  // Clean up recent test record
  db.prepare('DELETE FROM weather_snapshots WHERE id = ?').run(recentId);

  // Check stats
  const stats = getRetentionStats();
  assert.ok(typeof stats.totalSnapshots === 'number');
  assert.ok(stats.latestLogs.length > 0);
});
