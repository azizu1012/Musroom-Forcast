import React, { useState, useEffect } from 'react';
import { 
  CloudSun, 
  ShieldCheck, 
  RefreshCw, 
  Check, 
  LayoutList, 
  Sparkles,
  Navigation,
  Loader2
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

// Import All API & Geolocation Operations from Dedicated Service Module
import {
  getTrackedLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  searchLocationsApi,
  detectClientGeoLocation,
  fetchFullWeatherForecast,
  DEFAULT_FALLBACK_LOCATION
} from './services/weatherApi';

export default function App() {
  // State: Locations & Active Weather Target
  const [locations, setLocations] = useState([]);
  const [activeLocation, setActiveLocation] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(true);
  const [unit, setUnit] = useState('celsius'); // 'celsius' | 'fahrenheit'

  // Mobile sidebar toggle
  const [mobileShowSidebar, setMobileShowSidebar] = useState(true);

  // System & Chroma Modal & Toast
  const [isSystemModalOpen, setIsSystemModalOpen] = useState(false);
  const [isChromaModalOpen, setIsChromaModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const showToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  /**
   * 1. KHỞI TẠO ỨNG DỤNG & TỰ ĐỘNG LẤY TỌA ĐỘ GPS CỦA THIẾT BỊ CLIENT
   * Thay vì hardcode vị trí mặc định, ứng dụng yêu cầu quyền định vị của trình duyệt.
   * Nếu được cấp quyền, hiển thị ngay thời tiết và tên Phường/Xã thực tế của máy người dùng.
   */
  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      // Tải danh sách các địa điểm đã lưu trong DB
      let fetchedLocations = [];
      try {
        fetchedLocations = await getTrackedLocations();
        if (isMounted && Array.isArray(fetchedLocations) && fetchedLocations.length > 0) {
          setLocations(fetchedLocations);
        }
      } catch (err) {
        console.warn('[PulseWeather] Backend DB warming up:', err.message);
      }

      // Tự động nhận diện GPS Client
      try {
        setIsLocatingGps(true);
        const clientGps = await detectClientGeoLocation();
        if (isMounted) {
          setActiveLocation(clientGps);
          showToast(`📍 Đang xem thời tiết tại vị trí của bạn: ${clientGps.name}`);
        }
      } catch (gpsErr) {
        console.info('[PulseWeather] Client GPS skipped/denied:', gpsErr.message);
        if (isMounted) {
          // Fallback khi người dùng chặn quyền định vị
          const fallback = (fetchedLocations && fetchedLocations.length > 0)
            ? (fetchedLocations.find((l) => l.is_favorite) || fetchedLocations[0])
            : DEFAULT_FALLBACK_LOCATION;
          setActiveLocation(fallback);
          showToast('Đã dùng vị trí mặc định (bạn có thể nhấn nút 📍 GPS để định vị lại)');
        }
      } finally {
        if (isMounted) {
          setIsLocatingGps(false);
        }
      }
    };

    initializeApp();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Hàm bấm nút 📍 Định Vị GPS trên thanh điều hướng
   */
  const handleTriggerClientGps = async () => {
    setIsLocatingGps(true);
    showToast('Đang quét tọa độ GPS thiết bị của bạn...');
    try {
      const clientGps = await detectClientGeoLocation();
      setActiveLocation(clientGps);
      showToast(`📍 Đã cập nhật vị trí GPS: ${clientGps.name}`);
      // Trên mobile, tự động chuyển sang xem thời tiết
      if (window.innerWidth < 1024) {
        setMobileShowSidebar(false);
      }
    } catch (err) {
      console.warn('GPS prompt error:', err);
      showToast('⚠️ Không thể lấy vị trí. Vui lòng cho phép quyền truy cập Vị trí trên trình duyệt!');
    } finally {
      setIsLocatingGps(false);
    }
  };

  /**
   * 2. TẢI THỜI TIẾT KHI ĐỊA ĐIỂM HOẠT ĐỘNG THAY ĐỔI
   * Được quản lý tập trung qua service fetchFullWeatherForecast
   */
  const fetchForecastForLocation = async (loc) => {
    if (!loc) return;
    setLoadingForecast(true);
    try {
      const data = await fetchFullWeatherForecast(loc);
      setForecast(data);
    } catch (err) {
      console.error('[PulseWeather] Forecast retrieval failed:', err);
      showToast('⚠️ Lỗi tải dữ liệu thời tiết');
    } finally {
      setLoadingForecast(false);
    }
  };

  useEffect(() => {
    if (activeLocation) {
      fetchForecastForLocation(activeLocation);
    }
  }, [activeLocation]);

  /**
   * 3. CHROMA VECTOR AI SELECTION
   */
  const handleSelectCityFromChroma = async (cityName) => {
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
      try {
        const results = await searchLocationsApi(cityName);
        if (results && results.length > 0) {
          const item = results[0];
          await handleAddLocation({
            name: item.name,
            latitude: item.latitude,
            longitude: item.longitude,
            country: 'Vietnam',
            admin1: item.admin1,
            region: item.region,
            custom_label: 'Chroma AI Match'
          });
        }
      } catch (err) {
        console.error('Chroma search fallback failed:', err);
      }
    }
  };

  /**
   * 4. CRUD OPERATIONS (QUẢN LÝ ĐỊA ĐIỂM)
   */
  const handleAddLocation = async (newLocPayload) => {
    try {
      const created = await createLocation(newLocPayload);
      setLocations((prev) => [created, ...prev]);
      setActiveLocation(created);
      showToast(`Đã lưu '${created.name}'`);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleUpdateLocation = async (id, updatePayload) => {
    try {
      const updated = await updateLocation(id, updatePayload);
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
      await deleteLocation(id);
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
    if (!loc || !loc.id || typeof loc.id !== 'number') {
      showToast('Vị trí GPS tạm thời không thể đổi trạng thái lưu');
      return;
    }
    await handleUpdateLocation(loc.id, { is_favorite: loc.is_favorite ? 0 : 1 });
  };

  const handleSelectLocationFromSidebar = (loc) => {
    setActiveLocation(loc);
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* GPS Client Location Button */}
            <button
              className="apple-btn-pill"
              style={{
                background: activeLocation?.is_gps 
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.28), rgba(56, 189, 248, 0.28))'
                  : 'rgba(255, 255, 255, 0.08)',
                borderColor: activeLocation?.is_gps ? '#10b981' : 'var(--border-glass)',
                color: activeLocation?.is_gps ? '#34d399' : 'var(--text-secondary)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              onClick={handleTriggerClientGps}
              disabled={isLocatingGps}
              title="Định vị vị trí hiện tại của thiết bị (GPS)"
            >
              {isLocatingGps ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Navigation size={14} color={activeLocation?.is_gps ? '#34d399' : 'currentColor'} />
              )}
              <span>{activeLocation?.is_gps ? 'Vị Trí Của Bạn' : 'Định Vị GPS'}</span>
            </button>

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
