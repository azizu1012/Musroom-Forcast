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
import MushroomAgroMetrics from './components/MushroomAgroMetrics';

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
      `&current=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
      `&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m,uv_index,visibility,dew_point_2m,vapor_pressure_deficit,soil_temperature_0cm,soil_temperature_6cm,soil_temperature_18cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,et0_fao_evapotranspiration,shortwave_radiation` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,precipitation_hours,wind_speed_10m_max,wind_gusts_10m_max,et0_fao_evapotranspiration,shortwave_radiation_sum` +
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
    const currentTimeStr = fData.current?.time || fData.current_weather?.time || new Date().toISOString().slice(0, 13);
    let startIndex = hourlyTimes.findIndex(t => t >= currentTimeStr);
    if (startIndex < 0) startIndex = 0;

    const next24h = [];
    for (let i = startIndex; i < Math.min(startIndex + 24, hourlyTimes.length); i++) {
      next24h.push({
        time: hourlyTimes[i],
        temperature: fData.hourly.temperature_2m?.[i],
        apparentTemperature: fData.hourly.apparent_temperature?.[i],
        humidity: fData.hourly.relative_humidity_2m?.[i] ?? 65,
        dewPoint: fData.hourly.dew_point_2m?.[i] ?? 22,
        vpd: fData.hourly.vapor_pressure_deficit?.[i] != null ? +(fData.hourly.vapor_pressure_deficit[i].toFixed(2)) : 0.8,
        precipitationProbability: fData.hourly.precipitation_probability?.[i] ?? 0,
        precipitation: fData.hourly.precipitation?.[i] ?? 0,
        weatherCode: fData.hourly.weather_code?.[i],
        windSpeed: fData.hourly.wind_speed_10m?.[i],
        uvIndex: fData.hourly.uv_index?.[i] ?? 0,
        soilTemperature0cm: fData.hourly.soil_temperature_0cm?.[i] ?? fData.hourly.temperature_2m?.[i],
        soilTemperature6cm: fData.hourly.soil_temperature_6cm?.[i] ?? (fData.hourly.temperature_2m?.[i] ? +(fData.hourly.temperature_2m[i] - 1.5).toFixed(1) : 26),
        soilMoisture0To1cm: fData.hourly.soil_moisture_0_to_1cm?.[i] != null ? +(fData.hourly.soil_moisture_0_to_1cm[i] * 100).toFixed(1) : 32.5,
        soilMoisture1To3cm: fData.hourly.soil_moisture_1_to_3cm?.[i] != null ? +(fData.hourly.soil_moisture_1_to_3cm[i] * 100).toFixed(1) : 34.0,
        soilMoisture3To9cm: fData.hourly.soil_moisture_3_to_9cm?.[i] != null ? +(fData.hourly.soil_moisture_3_to_9cm[i] * 100).toFixed(1) : 35.5,
        soilMoisture9To27cm: fData.hourly.soil_moisture_9_to_27cm?.[i] != null ? +(fData.hourly.soil_moisture_9_to_27cm[i] * 100).toFixed(1) : 37.0,
        et0: fData.hourly.et0_fao_evapotranspiration?.[i] ?? 0.2,
        solarRadiation: Math.round(fData.hourly.shortwave_radiation?.[i] ?? 200)
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
      windGustsMax: fData.daily.wind_gusts_10m_max?.[idx] ?? 0,
      et0: fData.daily.et0_fao_evapotranspiration?.[idx] ?? 2.8,
      solarRadiationSum: fData.daily.shortwave_radiation_sum?.[idx] ?? 14.5
    }));

    const aqiVal = aData?.current?.us_aqi ?? 35;
    let aqiCat = { label: 'Tốt (Good)', color: '#34d399' };
    if (aqiVal > 150) aqiCat = { label: 'Xấu (Unhealthy)', color: '#ef4444' };
    else if (aqiVal > 100) aqiCat = { label: 'Kém (Sensitive)', color: '#f97316' };
    else if (aqiVal > 50) aqiCat = { label: 'Trung bình (Moderate)', color: '#f59e0b' };

    const currentTemp = fData.current?.temperature_2m ?? fData.current_weather?.temperature ?? 28;
    const currentHumidity = fData.current?.relative_humidity_2m ?? next24h[0]?.humidity ?? 68;
    const currentDewPoint = fData.current?.dew_point_2m ?? next24h[0]?.dewPoint ?? 22.5;
    const currentVpd = next24h[0]?.vpd ?? 0.85;
    const currentSoilT0 = next24h[0]?.soilTemperature0cm ?? currentTemp;
    const currentSoilT6 = next24h[0]?.soilTemperature6cm ?? +(currentTemp - 1.5).toFixed(1);
    const currentSoilM0_1 = next24h[0]?.soilMoisture0To1cm ?? 32.5;
    const currentSoilM1_3 = next24h[0]?.soilMoisture1To3cm ?? 34.0;
    const currentSoilM3_9 = next24h[0]?.soilMoisture3To9cm ?? 35.5;
    const currentSoilM9_27 = next24h[0]?.soilMoisture9To27cm ?? 37.0;

    // Client-side mushroom suitability index
    const rhScore = currentHumidity >= 80 && currentHumidity <= 92 ? 100 : (currentHumidity >= 70 ? 80 : 55);
    const vpdScore = currentVpd >= 0.3 && currentVpd <= 0.75 ? 100 : (currentVpd <= 1.0 ? 75 : 50);
    const moistScore = currentSoilM0_1 >= 28 && currentSoilM0_1 <= 42 ? 100 : 70;
    const overallScore = Math.round(rhScore * 0.4 + vpdScore * 0.35 + moistScore * 0.25);

    const mushroomAgro = {
      overallScore,
      status: overallScore >= 80 ? 'Môi Trường Lý Tưởng Phát Triển Quả Thể' : (currentVpd > 1.0 ? 'Cảnh Báo Khô Hạn - Cần Phun Sương' : 'Ẩm Bão Hòa - Cần Thông Khí'),
      statusColor: overallScore >= 80 ? '#34d399' : (currentVpd > 1.0 ? '#fb923c' : '#38bdf8'),
      actionAdvice: overallScore >= 80 
        ? 'Khí hậu và ẩm độ đang trong vùng vàng (Golden Zone) để kích thích mầm nấm phát triển mọc rộ.'
        : (currentVpd > 1.0 ? 'Không khí khô bốc hơi nhanh. Cần phun sương giữ ẩm và che chắn gió lùa.' : 'Không khí bão hòa ẩm, hãy mở cửa thông gió đối lưu để tránh đọng sương thối mũ.'),
      vpdStatus: currentVpd >= 0.3 && currentVpd <= 0.75 ? 'Tối ưu (0.3 - 0.75 kPa)' : (currentVpd > 0.75 ? 'Thoát Hơi Nhanh' : 'Ẩm Bão Hòa'),
      species: [
        {
          name: 'Nấm Rơm',
          scientific: 'Volvariella volvacea',
          optTemp: '30 - 35°C',
          optHumidity: '80 - 90%',
          optMoist: '32 - 40%',
          score: Math.max(30, Math.min(100, Math.round(100 - Math.abs(currentTemp - 32) * 5.5 - Math.abs(currentHumidity - 85) * 1.5))),
          suitability: currentTemp >= 28 && currentTemp <= 36 && currentHumidity >= 75 ? 'Rất Thích Hợp' : 'Khá Thích Hợp',
          note: 'Ưa ấm nhiệt đới. Khi quả thể dạng búp cần duy trì ẩm độ luống rơm 65-70%.'
        },
        {
          name: 'Nấm Bào Ngư / Nấm Sò',
          scientific: 'Pleurotus spp.',
          optTemp: '22 - 28°C',
          optHumidity: '85 - 90%',
          optMoist: '28 - 38%',
          score: Math.max(30, Math.min(100, Math.round(100 - Math.abs(currentTemp - 25) * 6 - Math.abs(currentHumidity - 88) * 1.5))),
          suitability: currentTemp >= 20 && currentTemp <= 29 && currentHumidity >= 78 ? 'Rất Thích Hợp' : 'Khá Thích Hợp',
          note: 'Dễ trồng, cho năng suất cao. Tuyệt đối không tưới thẳng nước lạnh vào cổ bịch phôi.'
        },
        {
          name: 'Nấm Mối / Nấm Mối Đen',
          scientific: 'Termitomyces / Oudemansiella',
          optTemp: '25 - 30°C',
          optHumidity: '85 - 95%',
          optMoist: '35 - 45%',
          score: Math.max(30, Math.min(100, Math.round(100 - Math.abs(currentTemp - 27) * 5 - Math.abs(currentHumidity - 90) * 1.2))),
          suitability: currentTemp >= 23 && currentTemp <= 31 && currentHumidity >= 80 ? 'Rất Thích Hợp' : 'Cần Tăng Độ Ẩm Đất',
          note: 'Ưa tầng đất ẩm sâu và mùn hữu cơ. Rất nhạy cảm với sự chênh lệch ẩm độ ngày đêm.'
        },
        {
          name: 'Nấm Linh Chi',
          scientific: 'Ganoderma lucidum',
          optTemp: '22 - 28°C',
          optHumidity: '80 - 85%',
          optMoist: '25 - 35%',
          score: Math.max(30, Math.min(100, Math.round(100 - Math.abs(currentTemp - 25) * 5 - Math.abs(currentHumidity - 82) * 2))),
          suitability: currentTemp >= 20 && currentTemp <= 30 && currentHumidity >= 75 ? 'Rất Thích Hợp' : 'Trung Bình',
          note: 'Dược liệu quý. Cần ánh sáng khuếch tán đồng đều để quả thể phân nhánh xòe đẹp.'
        },
        {
          name: 'Nấm Mèo / Mộc Nhĩ',
          scientific: 'Auricularia auricula',
          optTemp: '25 - 32°C',
          optHumidity: '80 - 90%',
          optMoist: '28 - 38%',
          score: Math.max(30, Math.min(100, Math.round(100 - Math.abs(currentTemp - 28) * 5 - Math.abs(currentHumidity - 85) * 1.5))),
          suitability: currentTemp >= 24 && currentTemp <= 33 && currentHumidity >= 75 ? 'Rất Thích Hợp' : 'Khá Thích Hợp',
          note: 'Khả năng chịu nhiệt tốt, tốc độ lớn nhanh khi độ ẩm không khí đạt trên 85%.'
        }
      ]
    };

    const current = {
      ...(fData.current_weather || {}),
      temperature: currentTemp,
      cityName,
      apparentTemperature: fData.current?.apparent_temperature ?? next24h[0]?.apparentTemperature ?? currentTemp,
      humidity: currentHumidity,
      dewPoint: currentDewPoint,
      pressure: Math.round(fData.current?.surface_pressure ?? fData.hourly?.surface_pressure?.[startIndex] ?? 1013),
      uvIndex: next24h[0]?.uvIndex ?? 5,
      uvMax: daily16[0]?.uvIndexMax ?? 6,
      visibilityKm: fData.hourly?.visibility?.[startIndex] ? +(fData.hourly.visibility[startIndex] / 1000).toFixed(1) : 10,
      windspeed: fData.current?.wind_speed_10m ?? fData.current_weather?.windspeed ?? 10,
      winddirection: fData.current?.wind_direction_10m ?? fData.current_weather?.winddirection ?? 0,
      windGusts: daily16[0]?.windGustsMax ?? Math.round((fData.current?.wind_speed_10m || 10) * 1.3),
      precipitationSum: daily16[0]?.precipitationSum ?? 0,
      precipitationHours: daily16[0]?.precipitationHours ?? 0,
      precipitationProbabilityMax: daily16[0]?.precipitationProbabilityMax ?? 0,
      
      vpd: currentVpd,
      soilTemperature0cm: currentSoilT0,
      soilTemperature6cm: currentSoilT6,
      soilMoisture0To1cm: currentSoilM0_1,
      soilMoisture1To3cm: currentSoilM1_3,
      soilMoisture3To9cm: currentSoilM3_9,
      soilMoisture9To27cm: currentSoilM9_27,
      evapotranspiration: next24h[0]?.et0 ?? 0.25,
      solarRadiation: next24h[0]?.solarRadiation ?? 220,
      mushroomAgro,

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
      mushroomAgro,
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

            {/* Smart Mushroom & Soil Agro-Climate Intelligence System */}
            <MushroomAgroMetrics forecast={forecast} unit={unit} />

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
