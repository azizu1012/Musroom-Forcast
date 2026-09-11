import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { db, dbPath } from './db.js';
import { initRetentionScheduler, purgeOldRecords, getRetentionStats } from './retention.js';
import { getChromaStatus, querySemanticWeather, syncAllSnapshotsToChroma } from './chromaService.js';
import { searchLocations, getFullForecast, getHistoricalComparison } from './weatherService.js';
import { 
  securityHeaders, 
  apiLimiter, 
  searchLimiter, 
  crudLimiter, 
  sanitizeString, 
  validateCoordinates, 
  secureErrorHandler 
} from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(cors({ origin: true }));
app.use(express.json({ limit: '50kb' })); // Restrict body payload size

// Normalize URL prefix for Vercel Serverless rewrites
if (process.env.VERCEL) {
  app.use((req, res, next) => {
    if (
      !req.url.startsWith('/api') && 
      !req.url.startsWith('/dist') && 
      !req.url.startsWith('/assets') && 
      !req.url.startsWith('/favicon.ico') &&
      req.url !== '/' &&
      req.url !== '/index.html'
    ) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    next();
  });
}

app.use('/api/', apiLimiter);

// Initialize 3-year retention scheduler
initRetentionScheduler();

// ==========================================
// 1. SYSTEM HEALTH & DIAGNOSTICS
// ==========================================
app.get('/api/system/status', async (req, res) => {
  try {
    let dbSizeKb = 0;
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      dbSizeKb = Math.round(stats.size / 1024);
    }

    const retentionStats = getRetentionStats();
    const chromaStatus = await getChromaStatus();
    const locationCount = db.prepare('SELECT COUNT(*) as count FROM locations').get()?.count || 0;

    res.json({
      status: 'healthy',
      runtime: {
        nodeVersion: process.version,
        isIsolatedProjectRuntime: process.execPath.includes('.runtime'),
        platform: process.platform,
        uptimeSeconds: Math.floor(process.uptime())
      },
      database: {
        engine: 'SQLite native DatabaseSync',
        filePath: 'data/weather.db',
        sizeKb: dbSizeKb,
        locationsCount: locationCount,
        ...retentionStats
      },
      chromaService: chromaStatus,
      security: {
        headersSecured: true,
        rateLimitingActive: true,
        reverseProxyActive: true,
        serverMaskingEnabled: true
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve system status', code: 'STATUS_ERROR' });
  }
});

// ==========================================
// 1.5. CHROMADB VECTOR SEARCH & AI ENDPOINTS
// ==========================================
app.get('/api/chroma/status', async (req, res, next) => {
  try {
    const status = await getChromaStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

app.post('/api/chroma/query', searchLimiter, async (req, res, next) => {
  try {
    const { query, limit } = req.body;
    const sanitizedQuery = sanitizeString(query, 120);
    if (!sanitizedQuery) {
      return res.status(400).json({ error: 'Truy vấn tìm kiếm ngữ nghĩa không được để trống' });
    }
    const results = await querySemanticWeather(sanitizedQuery, limit || 6);
    res.json({ query: sanitizedQuery, count: results.length, results });
  } catch (err) {
    next(err);
  }
});

app.post('/api/chroma/sync', crudLimiter, async (req, res, next) => {
  try {
    const result = await syncAllSnapshotsToChroma();
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. LOCATIONS CRUD OPERATIONS
// ==========================================

// READ ALL
app.get('/api/locations', (req, res, next) => {
  try {
    const locations = db.prepare(`
      SELECT * FROM locations 
      ORDER BY is_favorite DESC, updated_at DESC, name ASC
    `).all();
    res.json(locations);
  } catch (err) {
    next(err);
  }
});

// CREATE
app.post('/api/locations', crudLimiter, (req, res, next) => {
  try {
    const { name, latitude, longitude, country, admin1, timezone, custom_label, notes, is_favorite, alert_rain_threshold } = req.body;

    const sanitizedName = sanitizeString(name, 80);
    if (!sanitizedName) {
      return res.status(400).json({ error: 'Location name is required', code: 'INVALID_NAME' });
    }

    const coordCheck = validateCoordinates(latitude, longitude);
    if (!coordCheck.valid) {
      return res.status(400).json({ error: coordCheck.message, code: 'INVALID_COORDINATES' });
    }

    // Check duplicate
    const existing = db.prepare(`
      SELECT id FROM locations WHERE name = ? AND round(latitude, 2) = round(?, 2) AND round(longitude, 2) = round(?, 2)
    `).get(sanitizedName, coordCheck.latitude, coordCheck.longitude);

    if (existing) {
      return res.status(409).json({ error: 'Location already exists in your tracked list', code: 'DUPLICATE_LOCATION' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO locations (name, latitude, longitude, country, admin1, timezone, custom_label, notes, is_favorite, alert_rain_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      sanitizedName,
      coordCheck.latitude,
      coordCheck.longitude,
      sanitizeString(country, 60),
      sanitizeString(admin1, 60),
      sanitizeString(timezone, 40) || 'auto',
      sanitizeString(custom_label, 50) || 'Tracked',
      sanitizeString(notes, 500) || '',
      is_favorite ? 1 : 0,
      typeof alert_rain_threshold === 'number' ? Math.min(100, Math.max(0, alert_rain_threshold)) : 60
    );

    const created = db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// UPDATE
app.put('/api/locations/:id', crudLimiter, (req, res, next) => {
  try {
    const locationId = parseInt(req.params.id, 10);
    if (isNaN(locationId)) {
      return res.status(400).json({ error: 'Invalid location ID', code: 'INVALID_ID' });
    }

    const existing = db.prepare('SELECT * FROM locations WHERE id = ?').get(locationId);
    if (!existing) {
      return res.status(404).json({ error: 'Location not found', code: 'NOT_FOUND' });
    }

    const { custom_label, notes, is_favorite, alert_rain_threshold, temp_unit } = req.body;

    const updateStmt = db.prepare(`
      UPDATE locations
      SET custom_label = COALESCE(?, custom_label),
          notes = COALESCE(?, notes),
          is_favorite = COALESCE(?, is_favorite),
          alert_rain_threshold = COALESCE(?, alert_rain_threshold),
          temp_unit = COALESCE(?, temp_unit),
          updated_at = datetime('now')
      WHERE id = ?
    `);

    updateStmt.run(
      custom_label !== undefined ? sanitizeString(custom_label, 50) : null,
      notes !== undefined ? sanitizeString(notes, 500) : null,
      is_favorite !== undefined ? (is_favorite ? 1 : 0) : null,
      typeof alert_rain_threshold === 'number' ? Math.min(100, Math.max(0, alert_rain_threshold)) : null,
      temp_unit === 'fahrenheit' ? 'fahrenheit' : (temp_unit === 'celsius' ? 'celsius' : null),
      locationId
    );

    const updated = db.prepare('SELECT * FROM locations WHERE id = ?').get(locationId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE
app.delete('/api/locations/:id', crudLimiter, (req, res, next) => {
  try {
    const locationId = parseInt(req.params.id, 10);
    if (isNaN(locationId)) {
      return res.status(400).json({ error: 'Invalid location ID', code: 'INVALID_ID' });
    }

    const existing = db.prepare('SELECT id, name FROM locations WHERE id = ?').get(locationId);
    if (!existing) {
      return res.status(404).json({ error: 'Location not found', code: 'NOT_FOUND' });
    }

    db.prepare('DELETE FROM locations WHERE id = ?').run(locationId);
    res.json({ success: true, message: `Location '${existing.name}' removed successfully` });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. WEATHER SEARCH & FORECAST (Open-Meteo Proxy)
// ==========================================

// Search Cities
app.get('/api/weather/search', searchLimiter, async (req, res, next) => {
  try {
    const query = sanitizeString(req.query.q, 50);
    if (!query || query.length < 2) {
      return res.json([]);
    }
    const results = await searchLocations(query);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// 16-Day Forecast (Maximum Open-Meteo Capability)
app.get('/api/weather/forecast', async (req, res, next) => {
  try {
    const { lat, lon, city, locationId } = req.query;
    const coordCheck = validateCoordinates(lat, lon);
    if (!coordCheck.valid) {
      return res.status(400).json({ error: coordCheck.message, code: 'INVALID_COORDINATES' });
    }

    const cityName = sanitizeString(city, 80) || 'Unknown Location';
    const locId = locationId ? parseInt(locationId, 10) : null;

    const forecast = await getFullForecast(coordCheck.latitude, coordCheck.longitude, cityName, locId);
    res.json(forecast);
  } catch (err) {
    next(err);
  }
});

// 3-Year Historical Weather Comparison
app.get('/api/weather/compare-history', async (req, res, next) => {
  try {
    const { lat, lon, city } = req.query;
    const coordCheck = validateCoordinates(lat, lon);
    if (!coordCheck.valid) {
      return res.status(400).json({ error: coordCheck.message, code: 'INVALID_COORDINATES' });
    }

    const cityName = sanitizeString(city, 80) || 'Unknown Location';
    const comparison = await getHistoricalComparison(coordCheck.latitude, coordCheck.longitude, cityName);
    res.json(comparison);
  } catch (err) {
    next(err);
  }
});

// Stored snapshots in SQLite .db
app.get('/api/weather/snapshots', (req, res, next) => {
  try {
    const { city, limit = 30 } = req.query;
    const maxLimit = Math.min(100, parseInt(limit, 10) || 30);

    let query = 'SELECT * FROM weather_snapshots';
    const params = [];

    if (city) {
      query += ' WHERE city_name LIKE ?';
      params.push(`%${sanitizeString(city, 50)}%`);
    }

    query += ' ORDER BY recorded_at DESC LIMIT ?';
    params.push(maxLimit);

    const snapshots = db.prepare(query).all(...params);
    res.json(snapshots);
  } catch (err) {
    next(err);
  }
});

// Manual 3-year data purge trigger
app.post('/api/admin/cleanup', crudLimiter, (req, res) => {
  const result = purgeOldRecords();
  res.json(result);
});

// ==========================================
// 4. PRODUCTION STATIC SERVING
// ==========================================
const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Secure Error Handler
app.use(secureErrorHandler);

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[WEATHER APP SERVER] Server running on http://localhost:${PORT}`);
    console.log(`[DATABASE] SQLite file: ${dbPath}`);
    console.log(`[SECURITY] Helmet & Reverse Proxy Active. Sensitive headers masked.`);
  });
}

export default app;
