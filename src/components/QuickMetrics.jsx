import React from 'react';
import { 
  Sun, 
  Wind, 
  Droplets, 
  Activity, 
  Sunset, 
  Compass, 
  Thermometer, 
  Gauge,
  Eye,
  CloudRain
} from 'lucide-react';

export default function QuickMetrics({ forecast, unit }) {
  if (!forecast || !forecast.current) return null;

  const { current, daily16 } = forecast;

  const displayTemp = (celsius) => {
    if (celsius === undefined || celsius === null) return '--';
    if (unit === 'fahrenheit') {
      return Math.round((celsius * 9) / 5 + 32);
    }
    return Math.round(celsius);
  };

  const windSpeedDisplay = (speed = current.windspeed) => {
    if (unit === 'fahrenheit') {
      return `${(speed * 0.621371).toFixed(0)} mph`;
    }
    return `${speed.toFixed(0)} km/h`;
  };

  const getUvInfo = (uv) => {
    if (uv <= 2) return { category: 'Thấp', advice: 'Mức độ an toàn trong ngày.', percent: 15 };
    if (uv <= 5) return { category: 'Trung bình', advice: 'Nên dùng kem chống nắng khi ra ngoài.', percent: 40 };
    if (uv <= 7) return { category: 'Cao', advice: 'Cần che chắn khi ra ngoài từ 10h - 15h.', percent: 65 };
    if (uv <= 10) return { category: 'Rất cao', advice: 'Giảm thiểu thời gian ngoài trời nắng gắt.', percent: 85 };
    return { category: 'Nguy hại', advice: 'Tránh ra ngoài vào buổi trưa.', percent: 100 };
  };

  const uvInfo = getUvInfo(current.uvIndex);
  const sunriseTime = daily16?.[0]?.sunrise?.split('T')[1]?.slice(0, 5) || '05:45';
  const sunsetTime = daily16?.[0]?.sunset?.split('T')[1]?.slice(0, 5) || '18:00';

  // AQI pointer percent
  const aqiScore = current.aqi || 35;
  const aqiPercent = Math.min(100, Math.max(5, (aqiScore / 200) * 100));

  return (
    <div className="apple-widgets-grid">
      {/* 1. CHẤT LƯỢNG KHÔNG KHÍ (AQI) & KHÍ THẢI */}
      <div className="apple-widget">
        <div className="widget-header">
          <Activity size={14} />
          <span>Chất Lượng Không Khí</span>
        </div>

        <div className="widget-main-value">
          {aqiScore}
          <span style={{ fontSize: '1rem', fontWeight: 500, marginLeft: '0.5rem', color: current.aqiCategory?.color || '#34d399' }}>
            - {current.aqiCategory?.label || 'Tốt'}
          </span>
        </div>

        <div className="aqi-bar">
          <div className="aqi-pointer" style={{ left: `${aqiPercent}%` }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          <div>PM2.5: <strong style={{ color: '#fff' }}>{current.pm25} µg/m³</strong></div>
          <div>PM10: <strong style={{ color: '#fff' }}>{current.pm10} µg/m³</strong></div>
          <div>Ozone (O₃): <strong style={{ color: '#fff' }}>{current.ozone} µg/m³</strong></div>
          <div>NO₂: <strong style={{ color: '#fff' }}>{current.no2} µg/m³</strong></div>
        </div>
      </div>

      {/* 2. CHỈ SỐ UV & ĐỈNH NẮNG */}
      <div className="apple-widget">
        <div className="widget-header">
          <Sun size={14} />
          <span>Chỉ Số UV</span>
        </div>

        <div className="widget-main-value">
          {current.uvIndex}
          <span style={{ fontSize: '0.95rem', fontWeight: 400, marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
            (Đỉnh {current.uvMax})
          </span>
        </div>

        <div className="widget-subtitle">
          {uvInfo.category}
        </div>

        <div className="aqi-bar">
          <div className="aqi-pointer" style={{ left: `${uvInfo.percent}%` }} />
        </div>

        <div className="widget-footer-note">
          {uvInfo.advice}
        </div>
      </div>

      {/* 3. MẶT TRỜI LẶN & BÌNH MINH */}
      <div className="apple-widget">
        <div className="widget-header">
          <Sunset size={14} />
          <span>Mặt Trời Lặn</span>
        </div>

        <div className="widget-main-value">
          {sunsetTime}
        </div>

        <div style={{ margin: '0.75rem 0', height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />

        <div className="widget-footer-note">
          Bình minh ngày mai vào lúc {sunriseTime}. Chu kỳ nhật nguyệt kéo dài khoảng 12 giờ.
        </div>
      </div>

      {/* 4. GIÓ & GIÓ GIẬT MAX */}
      <div className="apple-widget">
        <div className="widget-header">
          <Wind size={14} />
          <span>Gió & Gió Giật</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="widget-main-value">
              {windSpeedDisplay()}
            </div>
            <div className="widget-subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Gió giật lên tới {windSpeedDisplay(current.windGusts)}
            </div>
          </div>

          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.05)'
            }}
          >
            <Compass
              size={24}
              color="#38bdf8"
              style={{
                transform: `rotate(${current.winddirection || 0}deg)`,
                transition: 'transform 0.6s ease'
              }}
            />
          </div>
        </div>

        <div className="widget-footer-note" style={{ marginTop: '0.5rem' }}>
          Hướng gió {current.winddirection || 0}°. Luồng gió đối lưu ổn định.
        </div>
      </div>

      {/* 5. LƯỢNG MƯA & XÁC SUẤT MƯA */}
      <div className="apple-widget">
        <div className="widget-header">
          <CloudRain size={14} />
          <span>Lượng Mưa 24 Giờ</span>
        </div>

        <div className="widget-main-value">
          {current.precipitationSum} <span style={{ fontSize: '1rem', fontWeight: 400 }}>mm</span>
        </div>

        <div className="widget-subtitle" style={{ fontSize: '0.88rem' }}>
          Xác suất mưa tối đa: {current.precipitationProbabilityMax}%
        </div>

        <div className="widget-footer-note" style={{ marginTop: '0.5rem' }}>
          {current.precipitationHours > 0
            ? `Dự kiến có mưa rải rác trong khoảng ${current.precipitationHours} giờ.`
            : 'Thời tiết khô ráo, không có mưa đáng kể trong 24 giờ tới.'}
        </div>
      </div>

      {/* 6. CẢM GIÁC NHƯ & ĐIỂM SƯƠNG */}
      <div className="apple-widget">
        <div className="widget-header">
          <Thermometer size={14} />
          <span>Cảm Giác Như & Điểm Sương</span>
        </div>

        <div className="widget-main-value">
          {displayTemp(current.apparentTemperature)}°
        </div>

        <div className="widget-subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Điểm sương: {displayTemp(current.dewPoint)}°
        </div>

        <div className="widget-footer-note" style={{ marginTop: '0.5rem' }}>
          {current.apparentTemperature > current.temperature
            ? 'Độ ẩm kết hợp nhiệt độ làm tăng cảm giác oi bức ngoài trời.'
            : 'Gió nhẹ khiến nhiệt độ cảm nhận dễ chịu.'}
        </div>
      </div>

      {/* 7. TẦM NHÌN XA */}
      <div className="apple-widget">
        <div className="widget-header">
          <Eye size={14} />
          <span>Tầm Nhìn Xa</span>
        </div>

        <div className="widget-main-value">
          {current.visibilityKm} <span style={{ fontSize: '1rem', fontWeight: 400 }}>km</span>
        </div>

        <div className="widget-subtitle" style={{ fontSize: '0.88rem', color: current.visibilityKm >= 9 ? '#34d399' : '#fbbf24' }}>
          {current.visibilityKm >= 9 ? 'Tầm nhìn hoàn hảo' : 'Hạn chế bởi sương/mù'}
        </div>

        <div className="widget-footer-note" style={{ marginTop: '0.5rem' }}>
          Tầm nhìn thoáng đãng, an toàn cho việc lái xe và hàng không.
        </div>
      </div>

      {/* 8. ÁP SUẤT KHÍ QUYỂN */}
      <div className="apple-widget">
        <div className="widget-header">
          <Gauge size={14} />
          <span>Áp Suất Bề Mặt</span>
        </div>

        <div className="widget-main-value">
          {current.pressure} <span style={{ fontSize: '1rem', fontWeight: 400 }}>hPa</span>
        </div>

        <div className="widget-subtitle" style={{ fontSize: '0.88rem', color: '#38bdf8' }}>
          Áp suất tiêu chuẩn
        </div>

        <div className="widget-footer-note" style={{ marginTop: '0.5rem' }}>
          Áp suất khí quyển ổn định, ít có biến động bão áp thấp.
        </div>
      </div>
    </div>
  );
}
