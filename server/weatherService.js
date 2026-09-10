import { db } from './db.js';
import { syncToChroma } from './chromaService.js';

// In-memory cache for API responses (5 minutes TTL for forecast, 1 hour for geocoding)
const cache = new Map();

function getCached(key, ttlSeconds = 300) {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < ttlSeconds * 1000) {
    return item.data;
  }
  return null;
}

function setCached(key, data) {
  // Evict old entries if cache grows too large
  if (cache.size > 200) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { timestamp: Date.now(), data });
}

/**
 * Geocoding Search: Dual OpenStreetMap Nominatim & Open-Meteo engine
 * Accurately finds every Phường, Xã, Thị trấn across Vietnam
 */
export async function searchLocations(query) {
  if (!query || query.trim().length < 2) return [];

  const rawQuery = query.trim();
  const cacheKey = `geo_vn_${rawQuery.toLowerCase()}`;
  const cached = getCached(cacheKey, 3600);
  if (cached) return cached;

  const results = [];
  const seenCoords = new Set();

  function addResult(item) {
    const lat = parseFloat(item.latitude || item.lat);
    const lon = parseFloat(item.longitude || item.lon);
    if (isNaN(lat) || isNaN(lon)) return;

    // Deduplicate within ~1km
    const coordKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
    if (seenCoords.has(coordKey)) return;
    seenCoords.add(coordKey);

    const name = item.name || '';
    const admin1 = item.admin1 || item.address?.state || item.address?.city || 'Việt Nam';
    
    // Determine region
    let region = 'Miền Nam';
    const combined = `${name} ${admin1}`.toLowerCase();
    if (combined.includes('hồ chí minh') || combined.includes('thủ đức') || combined.includes('sai gon')) {
      region = 'TP.HCM';
    } else if (combined.includes('hà nội')) {
      region = 'Hà Nội';
    } else if (lat >= 19.5) {
      region = 'Miền Bắc';
    } else if (lat >= 11.5 && lat < 19.5) {
      region = 'Miền Trung';
    }

    results.push({
      id: item.id || `osm_${Date.now()}_${results.length}`,
      name: name,
      latitude: parseFloat(lat.toFixed(4)),
      longitude: parseFloat(lon.toFixed(4)),
      country: 'Vietnam',
      admin1: admin1,
      region: region,
      timezone: 'Asia/Ho_Chi_Minh',
      display_name: item.display_name || `${name}, ${admin1}`
    });
  }

  // 1. Primary: Nominatim OpenStreetMap for precise Vietnamese administrative wards (Phường / Xã)
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(rawQuery)}&countrycodes=vn&format=json&addressdetails=1&limit=6`;
    const osmRes = await fetch(osmUrl, {
      headers: { 'User-Agent': 'PulseWeatherVietnam/1.0 (contact@pulseweather.local)' }
    });
    if (osmRes.ok) {
      const osmData = await osmRes.json();
      for (const item of osmData) {
        addResult({
          name: item.name || item.display_name.split(',')[0],
          lat: item.lat,
          lon: item.lon,
          admin1: item.address?.city || item.address?.state || item.address?.province || '',
          display_name: item.display_name
        });
      }
    }
  } catch (err) {
    console.warn('[WEATHER SERVICE] Nominatim lookup warning:', err.message);
  }

  // 2. Secondary: Open-Meteo Geocoding
  try {
    const omUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(rawQuery)}&count=6&language=vi&format=json&country_code=VN`;
    const omRes = await fetch(omUrl, { headers: { 'User-Agent': 'WeatherApp-Pulse/1.0' } });
    if (omRes.ok) {
      const omData = await omRes.json();
      for (const item of (omData.results || [])) {
        addResult(item);
      }
    }
  } catch (err) {
    console.warn('[WEATHER SERVICE] Open-Meteo geocoding warning:', err.message);
  }

  setCached(cacheKey, results);
  return results;
}

/**
 * Get Comprehensive Forecast:
 * - Current weather
 * - 24-hour hourly details
 * - 16-day daily forecast (maximum permitted by Open-Meteo API)
 * - Air Quality metrics
 */
export async function getFullForecast(lat, lon, cityName = 'Unknown', locationId = null) {
  const cacheKey = `forecast_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const cached = getCached(cacheKey, 300); // 5 min TTL
  if (cached) return cached;

  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current_weather=true` +
    `&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m,uv_index,visibility,dew_point_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,precipitation_hours,wind_speed_10m_max,wind_gusts_10m_max` +
    `&timezone=auto` +
    `&forecast_days=16`;

  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide`;

  try {
    const [forecastRes, aqiRes] = await Promise.allSettled([
      fetch(forecastUrl, { headers: { 'User-Agent': 'WeatherApp-Pulse/1.0' } }).then(r => r.json()),
      fetch(aqiUrl, { headers: { 'User-Agent': 'WeatherApp-Pulse/1.0' } }).then(r => r.json())
    ]);

    if (forecastRes.status !== 'fulfilled' || !forecastRes.value?.daily) {
      throw new Error('Failed to fetch forecast from Open-Meteo');
    }

    const forecastData = forecastRes.value;
    const aqiData = aqiRes.status === 'fulfilled' ? aqiRes.value : null;

    // Structure hourly data: slice next 24 hours
    const hourlyTimes = forecastData.hourly?.time || [];
    const currentTimeStr = forecastData.current_weather?.time || new Date().toISOString().slice(0, 13);
    let startIndex = hourlyTimes.findIndex(t => t >= currentTimeStr);
    if (startIndex < 0) startIndex = 0;
    const next24h = [];
    for (let i = startIndex; i < Math.min(startIndex + 24, hourlyTimes.length); i++) {
      next24h.push({
        time: hourlyTimes[i],
        temperature: forecastData.hourly.temperature_2m?.[i],
        apparentTemperature: forecastData.hourly.apparent_temperature?.[i],
        humidity: forecastData.hourly.relative_humidity_2m?.[i],
        precipitationProbability: forecastData.hourly.precipitation_probability?.[i] ?? 0,
        precipitation: forecastData.hourly.precipitation?.[i] ?? 0,
        weatherCode: forecastData.hourly.weather_code?.[i],
        windSpeed: forecastData.hourly.wind_speed_10m?.[i],
        uvIndex: forecastData.hourly.uv_index?.[i] ?? 0
      });
    }

    // Structure 16-day daily forecast
    const dailyTimes = forecastData.daily?.time || [];
    const daily16Days = dailyTimes.map((date, idx) => ({
      date,
      weatherCode: forecastData.daily.weather_code?.[idx],
      tempMax: forecastData.daily.temperature_2m_max?.[idx],
      tempMin: forecastData.daily.temperature_2m_min?.[idx],
      sunrise: forecastData.daily.sunrise?.[idx],
      sunset: forecastData.daily.sunset?.[idx],
      uvIndexMax: forecastData.daily.uv_index_max?.[idx] ?? 0,
      precipitationSum: forecastData.daily.precipitation_sum?.[idx] ?? 0,
      precipitationProbabilityMax: forecastData.daily.precipitation_probability_max?.[idx] ?? 0,
      precipitationHours: forecastData.daily.precipitation_hours?.[idx] ?? 0,
      windSpeedMax: forecastData.daily.wind_speed_10m_max?.[idx] ?? 0,
      windGustsMax: forecastData.daily.wind_gusts_10m_max?.[idx] ?? 0
    }));

    // Current weather object with comprehensive atmospheric metrics
    const current = {
      ...forecastData.current_weather,
      cityName,
      apparentTemperature: next24h[0]?.apparentTemperature ?? forecastData.current_weather.temperature,
      humidity: next24h[0]?.humidity ?? 65,
      pressure: Math.round(forecastData.hourly.surface_pressure?.[startIndex] ?? 1013),
      uvIndex: next24h[0]?.uvIndex ?? 5,
      uvMax: daily16Days[0]?.uvIndexMax ?? 6,
      visibilityKm: forecastData.hourly.visibility?.[startIndex] ? +(forecastData.hourly.visibility[startIndex] / 1000).toFixed(1) : 10,
      dewPoint: forecastData.hourly.dew_point_2m?.[startIndex] ? Math.round(forecastData.hourly.dew_point_2m[startIndex]) : 22,
      windGusts: daily16Days[0]?.windGustsMax ?? Math.round(forecastData.current_weather.windspeed * 1.3),
      precipitationSum: daily16Days[0]?.precipitationSum ?? 0,
      precipitationHours: daily16Days[0]?.precipitationHours ?? 0,
      precipitationProbabilityMax: daily16Days[0]?.precipitationProbabilityMax ?? 0,
      aqi: aqiData?.current?.us_aqi ?? aqiData?.current?.european_aqi ?? 35,
      aqiCategory: getAqiCategory(aqiData?.current?.us_aqi ?? 35),
      pm25: aqiData?.current?.pm2_5 ? +aqiData.current.pm2_5.toFixed(1) : 12.5,
      pm10: aqiData?.current?.pm10 ? +aqiData.current.pm10.toFixed(1) : 22.0,
      ozone: aqiData?.current?.ozone ? +aqiData.current.ozone.toFixed(1) : 38.0,
      no2: aqiData?.current?.nitrogen_dioxide ? +aqiData.current.nitrogen_dioxide.toFixed(1) : 16.0,
      co: aqiData?.current?.carbon_monoxide ? +aqiData.current.carbon_monoxide.toFixed(1) : 240.0
    };


    const combined = {
      city: cityName,
      latitude: lat,
      longitude: lon,
      timezone: forecastData.timezone,
      current,
      hourly24: next24h,
      daily16: daily16Days,
      forecastDaysCount: daily16Days.length,
      maxDaysSupported: 16
    };

    // Auto-save snapshot into SQLite .db for historical retention
    saveSnapshotToDb({
      locationId,
      cityName,
      latitude: lat,
      longitude: lon,
      date: current.time?.split('T')[0] || new Date().toISOString().split('T')[0],
      temperature: current.temperature,
      tempMax: daily16Days[0]?.tempMax ?? current.temperature,
      tempMin: daily16Days[0]?.tempMin ?? current.temperature,
      weatherCode: current.weathercode,
      precipitationProbability: next24h[0]?.precipitationProbability ?? 0,
      precipitationSum: daily16Days[0]?.precipitationSum ?? 0,
      windSpeed: current.windspeed,
      uvIndex: current.uvIndex,
      humidity: current.humidity
    });

    setCached(cacheKey, combined);
    return combined;
  } catch (error) {
    console.error('[WEATHER SERVICE] Forecast fetch error:', error.message);
    throw error;
  }
}

/**
 * Save snapshot to SQLite .db
 */
function saveSnapshotToDb(snapshot) {
  try {
    const today = snapshot.date;
    // Check if snapshot already exists for today and this city to avoid duplicate spam
    const existing = db.prepare(`
      SELECT id FROM weather_snapshots 
      WHERE city_name = ? AND date = ? 
      ORDER BY id DESC LIMIT 1
    `).get(snapshot.cityName, today);

    if (existing) {
      // Update existing snapshot
      const updateStmt = db.prepare(`
        UPDATE weather_snapshots 
        SET temperature = ?, temp_max = ?, temp_min = ?, weather_code = ?, 
            precipitation_probability = ?, wind_speed = ?, uv_index = ?, humidity = ?, recorded_at = datetime('now')
        WHERE id = ?
      `);
      updateStmt.run(
        snapshot.temperature,
        snapshot.tempMax,
        snapshot.tempMin,
        snapshot.weatherCode,
        snapshot.precipitationProbability,
        snapshot.windSpeed,
        snapshot.uvIndex,
        snapshot.humidity,
        existing.id
      );
    } else {
      // Insert new snapshot
      const insertStmt = db.prepare(`
        INSERT INTO weather_snapshots 
        (location_id, city_name, latitude, longitude, date, temperature, temp_max, temp_min, weather_code, precipitation_probability, precipitation_sum, wind_speed, uv_index, humidity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const res = insertStmt.run(
        snapshot.locationId,
        snapshot.cityName,
        snapshot.latitude,
        snapshot.longitude,
        snapshot.date,
        snapshot.temperature,
        snapshot.tempMax,
        snapshot.tempMin,
        snapshot.weatherCode,
        snapshot.precipitationProbability,
        snapshot.precipitationSum,
        snapshot.windSpeed,
        snapshot.uvIndex,
        snapshot.humidity
      );

      // Async sync to Chroma DB vector bridge
      syncToChroma({ id: res.lastInsertRowid, ...snapshot }).catch(() => {});
    }
  } catch (err) {
    console.error('[WEATHER SERVICE] DB snapshot error:', err.message);
  }
}

/**
 * Compare today's weather with historical data (1 year ago, 2 years ago, 3 years ago)
 * Queries SQLite .db first, then falls back to Open-Meteo Archive API
 */
export async function getHistoricalComparison(lat, lon, cityName = 'Unknown') {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const [year, month, day] = todayStr.split('-');

  const yearsAgo = [1, 2, 3];
  const comparisonResults = [];

  for (const y of yearsAgo) {
    const targetYear = parseInt(year, 10) - y;
    const targetDate = `${targetYear}-${month}-${day}`;

    // 1. Try to fetch from our SQLite .db
    const localRow = db.prepare(`
      SELECT * FROM weather_snapshots 
      WHERE city_name = ? AND date = ? 
      LIMIT 1
    `).get(cityName, targetDate);

    if (localRow) {
      comparisonResults.push({
        yearsAgo: y,
        year: targetYear,
        date: targetDate,
        tempMax: localRow.temp_max,
        tempMin: localRow.temp_min,
        avgTemp: localRow.temperature,
        weatherCode: localRow.weather_code,
        precipitationSum: localRow.precipitation_sum || 0,
        source: 'local_sqlite_db'
      });
      continue;
    }

    // 2. Fetch from Open-Meteo Archive API
    try {
      const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
        `&start_date=${targetDate}&end_date=${targetDate}` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
        `&timezone=auto`;

      const res = await fetch(archiveUrl, { headers: { 'User-Agent': 'WeatherApp-Pulse/1.0' } });
      if (res.ok) {
        const data = await res.json();
        const max = data.daily?.temperature_2m_max?.[0] ?? 25;
        const min = data.daily?.temperature_2m_min?.[0] ?? 18;
        const code = data.daily?.weather_code?.[0] ?? 1;
        const precip = data.daily?.precipitation_sum?.[0] ?? 0;
        const avg = +( (max + min) / 2 ).toFixed(1);

        comparisonResults.push({
          yearsAgo: y,
          year: targetYear,
          date: targetDate,
          tempMax: max,
          tempMin: min,
          avgTemp: avg,
          weatherCode: code,
          precipitationSum: precip,
          source: 'open_meteo_archive_api'
        });

        // Store into SQLite so next time it is 100% offline & local!
        try {
          db.prepare(`
            INSERT INTO weather_snapshots (city_name, latitude, longitude, date, temperature, temp_max, temp_min, weather_code, precipitation_sum, recorded_at, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'archive_synced')
          `).run(cityName, lat, lon, targetDate, avg, max, min, code, precip);
        } catch (e) {}
      }
    } catch (err) {
      console.warn(`[HISTORICAL ARCHIVE] Could not fetch ${targetDate}:`, err.message);
    }
  }

  return {
    cityName,
    targetDate: todayStr,
    comparisons: comparisonResults
  };
}

function getAqiCategory(aqi) {
  if (aqi <= 50) return { label: 'Good', color: '#10b981' };
  if (aqi <= 100) return { label: 'Moderate', color: '#f59e0b' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive', color: '#f97316' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444' };
  return { label: 'Hazardous', color: '#8b5cf6' };
}
