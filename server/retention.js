import { db } from './db.js';

/**
 * Retention Engine:
 * Purges weather snapshots older than 3 years (3 * 365 days = 1095 days).
 * Logs retention operations for audit and diagnostics.
 */
export function purgeOldRecords() {
  try {
    // 3 years cutoff: datetime('now', '-3 years')
    const countBefore = db.prepare('SELECT COUNT(*) as count FROM weather_snapshots').get()?.count || 0;

    const deleteStmt = db.prepare(`
      DELETE FROM weather_snapshots 
      WHERE datetime(recorded_at) < datetime('now', '-3 years')
    `);
    const result = deleteStmt.run();
    const deletedCount = result.changes || 0;

    const countAfter = db.prepare('SELECT COUNT(*) as count FROM weather_snapshots').get()?.count || 0;

    const logStmt = db.prepare(`
      INSERT INTO retention_logs (deleted_count, remaining_count, message)
      VALUES (?, ?, ?)
    `);
    logStmt.run(deletedCount, countAfter, `Purge executed. Deleted records older than 3 years. Remainder: ${countAfter}`);

    // If deleted items exist, optionally run incremental vacuum to reclaim disk
    if (deletedCount > 0) {
      db.exec('PRAGMA incremental_vacuum;');
    }

    return {
      success: true,
      deletedCount,
      remainingCount: countAfter,
      cutoff: '3 years (records before datetime("now", "-3 years"))'
    };
  } catch (error) {
    console.error('[RETENTION ERROR]', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get retention statistics for monitoring dashboard
 */
export function getRetentionStats() {
  try {
    const totalSnapshots = db.prepare('SELECT COUNT(*) as count FROM weather_snapshots').get()?.count || 0;
    const oldestRecord = db.prepare('SELECT recorded_at, date, city_name FROM weather_snapshots ORDER BY recorded_at ASC LIMIT 1').get() || null;
    const newestRecord = db.prepare('SELECT recorded_at, date, city_name FROM weather_snapshots ORDER BY recorded_at DESC LIMIT 1').get() || null;
    const latestLogs = db.prepare('SELECT * FROM retention_logs ORDER BY executed_at DESC LIMIT 5').all() || [];

    return {
      totalSnapshots,
      oldestRecord,
      newestRecord,
      retentionPolicy: 'Keep records up to 3 years (auto-purge older)',
      latestLogs
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Schedule automated daily retention check
 */
export function initRetentionScheduler() {
  // Execute immediately on startup
  console.log('[RETENTION] Running startup 3-year data retention sweep...');
  const res = purgeOldRecords();
  console.log(`[RETENTION] Startup sweep completed. Deleted: ${res.deletedCount || 0}, Remaining: ${res.remainingCount || 0}`);

  // Set interval every 24 hours (86,400,000 ms)
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    console.log('[RETENTION] Running scheduled 24h retention sweep...');
    purgeOldRecords();
  }, TWENTY_FOUR_HOURS);
}
