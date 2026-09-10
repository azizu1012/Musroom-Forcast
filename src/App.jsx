import React, { useState, useEffect } from 'react';
import { 
  CloudSun, 
  ShieldCheck, 
  RefreshCw, 
  Check, 
  Layers,
  LayoutList,
  Sparkles
} from 'lucide-react';

import WeatherCanvas from './components/WeatherCanvas';
import WeatherHero from './components/WeatherHero';
import QuickMetrics from './components/QuickMetrics';
import HourlySlider from './components/HourlySlider';
import Forecast16Days from './components/Forecast16Days';
import HistoricalComparator from './components/HistoricalComparator';
import LocationManager from './components/LocationManager';
import SystemModal from './components/SystemModal';
import ChromaModal from './components/ChromaModal';

const DEFAULT_LOCATION = {
  id: 1,
  name: 'Phường Bến Nghé',
  latitude: 10.7769,
  longitude: 106.7009,
  country: 'Vietnam',
  admin1: 'TP. Hồ Chí Minh',
  region: 'TP.HCM',
  custom_label: 'UBND TP.HCM / Phố đi bộ',
  is_favorite: 1
};

export default function App() {
  // State
  const [locations, setLocations] = useState([DEFAULT_LOCATION]);
  const [activeLocation, setActiveLocation] = useState(DEFAULT_LOCATION);
  const [forecast, setForecast] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [unit, setUnit] = useState('celsius'); // 'celsius' | 'fahrenheit'

  // Mobile sidebar toggle
  const [mobileShowSidebar, setMobileShowSidebar] = useState(true);

  // System & Chroma Modal & Toast
  const [isSystemModalOpen, setIsSystemModalOpen] = useState(false);
  const [isChromaModalOpen, setIsChromaModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const handleSelectCityFromChroma = (cityName) => {
    if (!cityName) return;
    const cleanCity = cityName.toLowerCase();
    const match = locations.find((l) => 
      l.name.toLowerCase() === cleanCity || 
      cleanCity.includes(l.name.toLowerCase()) || 
      l.name.toLowerCase().includes(cleanCity)
    );

    if (match) {
      setActiveLocation(match);
      showToast(`Đã chọn: ${match.name} (Chroma Vector AI)`);
    } else {
      fetch(`/api/weather/search?q=${encodeURIComponent(cityName)}`)
        .then((r) => r.json())
        .then((res) => {
          if (res && res.length > 0) {
            handleAddLocation({
              name: res[0].name,
              latitude: res[0].latitude,
              longitude: res[0].longitude,
              country: 'Vietnam',
              admin1: res[0].admin1,
              region: res[0].region,
              custom_label: 'Chroma AI Match'
            });
          }
        })
        .catch(() => {});
    }
  };

  const showToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // 1. Fetch Tracked Locations on mount with auto-retry
  const fetchLocations = async (retryCount = 0) => {
    try {
      const res = await fetch('/api/locations');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setLocations(data);
          const fav = data.find((l) => l.is_favorite) || data[0];
          setActiveLocation((curr) => curr?.id === 1 && !curr.admin1 ? fav : curr || fav);
        }
      } else if (retryCount < 2) {
        // Cold start retry
        setTimeout(() => fetchLocations(retryCount + 1), 1500);
      }
    } catch (err) {
      console.warn('Backend locations warming up:', err);
      if (retryCount < 2) {
        setTimeout(() => fetchLocations(retryCount + 1), 2000);
      }
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  // Direct client fallback to Open-Meteo in case serverless backend has cold start
  const fetchDirectOpenMeteo = async (lat, lon, cityName) => {
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true` +
      `&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m,uv_index,visibility,dew_point_2m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,precipitation_hours,wind_speed_10m_max,wind_gusts_10m_max` +
      `&timezone=auto&forecast_days=16`;

    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide`;

    const [fRes, aRes] = await Promise.allSettled([
      fetch(forecastUrl).then(r => r.json()),
      fetch(aqiUrl).then(r => r.json())
    ]);

    if (fRes.status !== 'fulfilled' || !fRes.value?.daily) {
      throw new Error('Direct Open-Meteo fetch failed');
    }

    const fData = fRes.value;
    const aData = aRes.status === 'fulfilled' ? aRes.value : null;

    const hourlyTimes = fData.hourly?.time || [];
    const currentTimeStr = fData.current_weather?.time || new Date().toISOString().slice(0, 13);
    let startIndex = hourlyTimes.findIndex(t => t >= currentTimeStr);
    if (startIndex < 0) startIndex = 0;

    const next24h = [];
    for (let i = startIndex; i < Math.min(startIndex + 24, hourlyTimes.length); i++) {
      next24h.push({
        time: hourlyTimes[i],
        temperature: fData.hourly.temperature_2m?.[i],
        apparentTemperature: fData.hourly.apparent_temperature?.[i],
        humidity: fData.hourly.relative_humidity_2m?.[i],
        precipitationProbability: fData.hourly.precipitation_probability?.[i] ?? 0,
        precipitation: fData.hourly.precipitation?.[i] ?? 0,
        weatherCode: fData.hourly.weather_code?.[i],
        windSpeed: fData.hourly.wind_speed_10m?.[i],
        uvIndex: fData.hourly.uv_index?.[i] ?? 0
      });
    }

    const dailyTimes = fData.daily?.time || [];
    const daily16 = dailyTimes.map((date, idx) => ({
      date,
      weatherCode: fData.daily.weather_code?.[idx],
      tempMax: fData.daily.temperature_2m_max?.[idx],
      tempMin: fData.daily.temperature_2m_min?.[idx],
      sunrise: fData.daily.sunrise?.[idx],
      sunset: fData.daily.sunset?.[idx],
      uvIndexMax: fData.daily.uv_index_max?.[idx] ?? 0,
      precipitationSum: fData.daily.precipitation_sum?.[idx] ?? 0,
      precipitationProbabilityMax: fData.daily.precipitation_probability_max?.[idx] ?? 0,
      precipitationHours: fData.daily.precipitation_hours?.[idx] ?? 0,
      windSpeedMax: fData.daily.wind_speed_10m_max?.[idx] ?? 0,
      windGustsMax: fData.daily.wind_gusts_10m_max?.[idx] ?? 0
    }));

    const aqiVal = aData?.current?.us_aqi ?? 35;
    let aqiCat = 'Tốt (Good)';
    if (aqiVal > 150) aqiCat = 'Xấu (Unhealthy)';
    else if (aqiVal > 100) aqiCat = 'Kém (Sensitive)';
    else if (aqiVal > 50) aqiCat = 'Trung bình (Moderate)';

    const current = {
      ...fData.current_weather,
      cityName,
      apparentTemperature: next24h[0]?.apparentTemperature ?? fData.current_weather.temperature,
      humidity: next24h[0]?.humidity ?? 65,
      pressure: Math.round(fData.hourly?.surface_pressure?.[startIndex] ?? 1013),
      uvIndex: next24h[0]?.uvIndex ?? 5,
      uvMax: daily16[0]?.uvIndexMax ?? 6,
      visibilityKm: fData.hourly?.visibility?.[startIndex] ? +(fData.hourly.visibility[startIndex] / 1000).toFixed(1) : 10,
      dewPoint: fData.hourly?.dew_point_2m?.[startIndex] ? Math.round(fData.hourly.dew_point_2m[startIndex]) : 22,
      windGusts: daily16[0]?.windGustsMax ?? Math.round(fData.current_weather.windspeed * 1.3),
      precipitationSum: daily16[0]?.precipitationSum ?? 0,
      precipitationHours: daily16[0]?.precipitationHours ?? 0,
      precipitationProbabilityMax: daily16[0]?.precipitationProbabilityMax ?? 0,
      aqi: aqiVal,
      aqiCategory: aqiCat,
      pm25: aData?.current?.pm2_5 ? +aData.current.pm2_5.toFixed(1) : 12.5,
      pm10: aData?.current?.pm10 ? +aData.current.pm10.toFixed(1) : 22.0,
      ozone: aData?.current?.ozone ? +aData.current.ozone.toFixed(1) : 38.0,
      no2: aData?.current?.nitrogen_dioxide ? +aData.current.nitrogen_dioxide.toFixed(1) : 16.0,
      co: aData?.current?.carbon_monoxide ? +aData.current.carbon_monoxide.toFixed(1) : 240.0
    };

    return {
      city: cityName,
      latitude: lat,
      longitude: lon,
      timezone: fData.timezone,
      current,
      hourly24: next24h,
      daily16,
      forecastDaysCount: daily16.length,
      maxDaysSupported: 16
    };
  };

  // 2. Fetch Forecast when active location changes (with seamless direct fallback)
  const fetchForecastForLocation = async (loc) => {
    if (!loc) return;
    setLoadingForecast(true);
    try {
      // Step A: Attempt server proxy with 3.5-second timeout
      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => controller.abort(), 3500);

      try {
        const res = await fetch(
          `/api/weather/forecast?lat=${loc.latitude}&lon=${loc.longitude}&city=${encodeURIComponent(loc.name)}&locationId=${loc.id || ''}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutTimer);
        if (res.ok) {
          const data = await res.json();
          setForecast(data);
          return;
        }
      } catch (proxyErr) {
        // Cold start delay or network lag -> proceed to direct fallback
        console.warn('Proxy cold start or timeout, using direct fallback:', proxyErr);
      }

      // Step B: Direct fallback fetch (0s delay, eliminates cold start error completely)
      const directData = await fetchDirectOpenMeteo(loc.latitude, loc.longitude, loc.name);
      setForecast(directData);
    } catch (err) {
      console.error('All forecast mechanisms failed:', err);
      showToast('Lỗi tải dữ liệu thời tiết');
    } finally {
      setLoadingForecast(false);
    }
  };

  useEffect(() => {
    if (activeLocation) {
      fetchForecastForLocation(activeLocation);
    }
  }, [activeLocation]);

  // CRUD Operations
  const handleAddLocation = async (newLocPayload) => {
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLocPayload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Không thể thêm địa điểm');
      }

      const created = await res.json();
      setLocations((prev) => [created, ...prev]);
      setActiveLocation(created);
      showToast(`Đã lưu '${created.name}'`);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleUpdateLocation = async (id, updatePayload) => {
    try {
      const res = await fetch(`/api/locations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });

      if (!res.ok) throw new Error('Không thể cập nhật địa điểm');
      const updated = await res.json();
      setLocations((prev) => prev.map((l) => (l.id === id ? updated : l)));
      if (activeLocation && activeLocation.id === id) {
        setActiveLocation(updated);
      }
      showToast(`Đã cập nhật '${updated.name}'`);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleDeleteLocation = async (id) => {
    try {
      const res = await fetch(`/api/locations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Không thể xóa địa điểm');

      setLocations((prev) => prev.filter((l) => l.id !== id));
      showToast('Đã xóa địa điểm');

      if (activeLocation && activeLocation.id === id) {
        const remaining = locations.filter((l) => l.id !== id);
        if (remaining.length > 0) setActiveLocation(remaining[0]);
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleToggleFavorite = async (loc) => {
    await handleUpdateLocation(loc.id, { is_favorite: loc.is_favorite ? 0 : 1 });
  };

  const handleSelectLocationFromSidebar = (loc) => {
    setActiveLocation(loc);
    // On mobile, automatically show the weather details pane
    if (window.innerWidth < 1024) {
      setMobileShowSidebar(false);
    }
  };

  return (
    <>
      {/* 100% Live Dynamic Atmospheric Renderer */}
      <WeatherCanvas
        weatherCode={forecast?.current?.weathercode ?? 0}
        isDay={forecast?.current?.is_day ?? 1}
      />

      <div className="apple-app-shell">
        {/* Apple Top Navigation Bar */}
        <header className="apple-nav">
          <div className="apple-brand">
            <div className="apple-brand-icon">
              <CloudSun size={20} />
            </div>
            <span className="apple-brand-title">Thời Tiết</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Mobile View Toggle */}
            <button
              className="apple-btn-pill"
              style={{ display: window.innerWidth < 1024 ? 'flex' : 'none' }}
              onClick={() => setMobileShowSidebar(!mobileShowSidebar)}
              title="Chuyển đổi danh sách / thời tiết"
            >
              <LayoutList size={14} />
              {mobileShowSidebar ? 'Xem Thời Tiết' : 'Danh Sách'}
            </button>

            {/* Unit Toggle */}
            <button
              className="apple-btn-pill"
              onClick={() => setUnit(unit === 'celsius' ? 'fahrenheit' : 'celsius')}
              title="Đổi đơn vị nhiệt độ"
            >
              °{unit === 'celsius' ? 'C' : 'F'}
            </button>

            {/* Refresh Current */}
            <button
              className="apple-btn-round"
              onClick={() => activeLocation && fetchForecastForLocation(activeLocation)}
              disabled={loadingForecast}
              title="Cập nhật thời tiết"
            >
              <RefreshCw size={15} className={loadingForecast ? 'animate-spin' : ''} />
            </button>

            {/* ChromaDB Vector AI Modal Button */}
            <button
              className="apple-btn-pill"
              style={{
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.22), rgba(139, 92, 246, 0.22))',
                borderColor: 'rgba(236, 72, 153, 0.45)',
                color: '#f472b6',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
              onClick={() => setIsChromaModalOpen(true)}
              title="ChromaDB Vector AI Search"
            >
              <Sparkles size={13} color="#f472b6" />
              <span>Chroma AI</span>
            </button>

            {/* System / Security Modal Button */}
            <button
              className="apple-btn-round"
              onClick={() => setIsSystemModalOpen(true)}
              title="Thông tin hệ thống & bảo mật"
            >
              <ShieldCheck size={16} color="#34d399" />
            </button>
          </div>
        </header>

        {/* Master-Detail Dual Stage Layout (Apple Weather iPad/macOS) */}
        <main className="apple-dual-stage">
          {/* Left Pane: Sidebar Locations with Fuse.js Typo-Tolerant Search */}
          <LocationManager
            locations={locations}
            activeLocation={activeLocation}
            onSelectLocation={handleSelectLocationFromSidebar}
            onAddLocation={handleAddLocation}
            onUpdateLocation={handleUpdateLocation}
            onDeleteLocation={handleDeleteLocation}
          />

          {/* Right Pane: Active Weather Dashboard */}
          <section className="apple-main-pane">
            {/* Apple Weather Hero Centerpiece */}
            <WeatherHero
              forecast={forecast}
              locationMeta={activeLocation}
              unit={unit}
              onToggleFavorite={handleToggleFavorite}
            />

            {/* 24-Hour Hourly Forecast Slider */}
            <HourlySlider hourly24={forecast?.hourly24} unit={unit} />

            {/* 16-Day Forecast with Apple Spectrum Bar */}
            <Forecast16Days 
              daily16={forecast?.daily16} 
              currentTemp={forecast?.current?.temperature} 
              unit={unit} 
            />

            {/* Apple Modular Grid Widgets (AQI, UV, Wind, Sunset, Feels Like, Humidity) */}
            <QuickMetrics forecast={forecast} unit={unit} />

            {/* 3-Year Historical Climate Trends */}
            <HistoricalComparator
              currentCity={activeLocation?.name}
              lat={activeLocation?.latitude}
              lon={activeLocation?.longitude}
              currentTemp={forecast?.current?.temperature}
              unit={unit}
            />
          </section>
        </main>

        {/* System & Security Modal */}
        <SystemModal
          isOpen={isSystemModalOpen}
          onClose={() => setIsSystemModalOpen(false)}
          onShowToast={showToast}
        />

        {/* ChromaDB AI Vector Search Modal */}
        <ChromaModal
          isOpen={isChromaModalOpen}
          onClose={() => setIsChromaModalOpen(false)}
          onSelectCity={handleSelectCityFromChroma}
        />

        {/* Apple Pill Toast Notification */}
        <div className="apple-toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className="apple-toast">
              <Check size={14} color="#34d399" />
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
