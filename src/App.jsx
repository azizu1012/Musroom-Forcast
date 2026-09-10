import React, { useState, useEffect } from 'react';
import { 
  CloudSun, 
  ShieldCheck, 
  RefreshCw, 
  Check, 
  Layers,
  LayoutList
} from 'lucide-react';

import WeatherCanvas from './components/WeatherCanvas';
import WeatherHero from './components/WeatherHero';
import QuickMetrics from './components/QuickMetrics';
import HourlySlider from './components/HourlySlider';
import Forecast16Days from './components/Forecast16Days';
import HistoricalComparator from './components/HistoricalComparator';
import LocationManager from './components/LocationManager';
import SystemModal from './components/SystemModal';

export default function App() {
  // State
  const [locations, setLocations] = useState([]);
  const [activeLocation, setActiveLocation] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [unit, setUnit] = useState('celsius'); // 'celsius' | 'fahrenheit'

  // Mobile sidebar toggle
  const [mobileShowSidebar, setMobileShowSidebar] = useState(true);

  // System Modal & Toast
  const [isSystemModalOpen, setIsSystemModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const showToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // 1. Fetch Tracked Locations on mount
  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations');
      if (res.ok) {
        const data = await res.json();
        setLocations(data);
        if (data.length > 0 && !activeLocation) {
          // Default to favorite (Quận 1, TP. Hồ Chí Minh)
          const fav = data.find((l) => l.is_favorite) || data[0];
          setActiveLocation(fav);
        }
      }
    } catch (err) {
      console.error('Failed to load locations:', err);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  // 2. Fetch Forecast when active location changes
  const fetchForecastForLocation = async (loc) => {
    if (!loc) return;
    setLoadingForecast(true);
    try {
      const res = await fetch(
        `/api/weather/forecast?lat=${loc.latitude}&lon=${loc.longitude}&city=${encodeURIComponent(loc.name)}&locationId=${loc.id || ''}`
      );
      if (!res.ok) throw new Error('Không thể tải dữ liệu thời tiết');
      const data = await res.json();
      setForecast(data);
    } catch (err) {
      console.error('Forecast error:', err);
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
