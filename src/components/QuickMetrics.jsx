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

      {/* 9. ĐỘ ẨM KHÔNG KHÍ (RELATIVE HUMIDITY) */}
      <div className="apple-widget">
        <div className="widget-header">
          <Droplets size={14} color="#38bdf8" />
          <span>Độ Ẩm Không Khí</span>
        </div>

        <div className="widget-main-value">
          {current.humidity} <span style={{ fontSize: '1rem', fontWeight: 400 }}>%</span>
        </div>

        <div className="widget-subtitle" style={{ fontSize: '0.88rem', color: current.humidity >= 80 && current.humidity <= 92 ? '#34d399' : (current.humidity < 70 ? '#fb923c' : '#38bdf8') }}>
          {current.humidity >= 80 && current.humidity <= 92 
            ? 'Lý tưởng ra quả thể nấm' 
            : (current.humidity >= 70 ? 'Thích hợp nuôi sợi' : (current.humidity > 92 ? 'Bão hòa ẩm' : 'Khô hanh'))}
        </div>

        <div className="aqi-bar" style={{ background: 'linear-gradient(to right, #fb923c, #fbbf24, #34d399, #38bdf8)' }}>
          <div className="aqi-pointer" style={{ left: `${Math.min(100, Math.max(5, current.humidity))}%` }} />
        </div>

        <div className="widget-footer-note" style={{ marginTop: '0.5rem' }}>
          Điểm sương hiện tại là {displayTemp(current.dewPoint)}°. Độ ẩm quyết định 70% năng suất nấm.
        </div>
      </div>

      {/* 10. ĐỘ ẨM ĐẤT & CƠ CHẤT (SOIL MOISTURE) */}
      <div className="apple-widget">
        <div className="widget-header">
          <Droplets size={14} color="#34d399" />
          <span>Độ Ẩm Đất Cơ Chất</span>
        </div>

        <div className="widget-main-value">
          {current.soilMoisture0To1cm ?? 32.5} <span style={{ fontSize: '1rem', fontWeight: 400 }}>% vol</span>
        </div>

        <div className="widget-subtitle" style={{ fontSize: '0.88rem', color: '#34d399' }}>
          Tầng sâu (3-9cm): {current.soilMoisture3To9cm ?? 35.5}% vol
        </div>

        <div className="aqi-bar" style={{ background: 'linear-gradient(to right, #f87171, #fbbf24, #34d399, #10b981)' }}>
          <div className="aqi-pointer" style={{ left: `${Math.min(100, Math.max(5, (current.soilMoisture0To1cm ?? 32.5) * 2))}%` }} />
        </div>

        <div className="widget-footer-note" style={{ marginTop: '0.5rem' }}>
          Độ ẩm giá thể tầng rễ tơ nấm đạt tiêu chuẩn giữ nước tốt.
        </div>
      </div>

      {/* 11. ÁP SUẤT HƠI THIẾU HỤT (VPD) */}
      <div className="apple-widget">
        <div className="widget-header">
          <Wind size={14} color="#38bdf8" />
          <span>Áp Suất Hơi Thiếu Hụt (VPD)</span>
        </div>

        <div className="widget-main-value">
          {current.vpd ?? 0.85} <span style={{ fontSize: '1rem', fontWeight: 400 }}>kPa</span>
        </div>

        <div className="widget-subtitle" style={{ fontSize: '0.88rem', color: (current.vpd ?? 0.85) >= 0.3 && (current.vpd ?? 0.85) <= 0.75 ? '#34d399' : '#fb923c' }}>
          {(current.vpd ?? 0.85) >= 0.3 && (current.vpd ?? 0.85) <= 0.75 ? 'Vùng vàng thoát hơi nấm' : 'Thoát hơi nhanh'}
        </div>

        <div className="widget-footer-note" style={{ marginTop: '0.5rem' }}>
          Chỉ số điều khiển béc phun sương ẩm cho nhà màng và trại nấm nông nghiệp.
        </div>
      </div>

      {/* 12. BỨC XẠ MẶT TRỜI (SOLAR RADIATION) */}
      <div className="apple-widget">
        <div className="widget-header">
          <Sun size={14} color="#fbbf24" />
          <span>Bức Xạ Mặt Trời</span>
        </div>

        <div className="widget-main-value">
          {current.solarRadiation ?? 220} <span style={{ fontSize: '1rem', fontWeight: 400 }}>W/m²</span>
        </div>

        <div className="widget-subtitle" style={{ fontSize: '0.88rem', color: '#fbbf24' }}>
          Bốc thoát hơi nước: {current.evapotranspiration ?? 0.25} mm/h
        </div>

        <div className="widget-footer-note" style={{ marginTop: '0.5rem' }}>
          Cường độ bức xạ sóng ngắn đo bằng Pyranometer, hỗ trợ canh tác quang kỳ.
        </div>
      </div>
    </div>
  );
}
