import React, { useState } from 'react';
import { getWeatherMeta } from '../utils/weatherIcons';
import { Calendar, ChevronDown, ChevronUp, Umbrella, Wind, Sun, Sunrise, Sunset } from 'lucide-react';

export default function Forecast16Days({ daily16, currentTemp, unit }) {
  const [showAll16Days, setShowAll16Days] = useState(false);
  const [expandedDate, setExpandedDate] = useState(null);

  if (!daily16 || daily16.length === 0) return null;

  const displayTemp = (celsius) => {
    if (celsius === undefined || celsius === null) return '--';
    if (unit === 'fahrenheit') {
      return Math.round((celsius * 9) / 5 + 32);
    }
    return Math.round(celsius);
  };

  // Compute global min and max across all 16 days for the Apple Spectrum Bar
  let globalMin = Infinity;
  let globalMax = -Infinity;
  daily16.forEach((d) => {
    if (d.tempMin < globalMin) globalMin = d.tempMin;
    if (d.tempMax > globalMax) globalMax = d.tempMax;
  });
  const tempSpan = Math.max(1, globalMax - globalMin);

  const getDayName = (dateStr, idx) => {
    if (idx === 0) return 'Hôm nay';
    const date = new Date(dateStr);
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return days[date.getDay()];
  };

  const toggleExpand = (date) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  // Default to 8 days (Hôm nay + 7 ngày tiếp theo) unless user expands
  const displayedDays = showAll16Days ? daily16 : daily16.slice(0, 8);

  return (
    <div className="apple-widget">
      {/* Widget Header with clean Senior Dev Title */}
      <div className="widget-header" style={{ justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Calendar size={14} />
          <span>Dự Báo Hàng Ngày</span>
        </div>

        <span style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
          {showAll16Days ? 'Toàn chuỗi 16 ngày' : '8 ngày tới'}
        </span>
      </div>

      {/* Days List */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {displayedDays.map((day, idx) => {
          const meta = getWeatherMeta(day.weatherCode, 1);
          const isExpanded = expandedDate === day.date;
          const isToday = idx === 0;

          // Apple Spectrum bar metrics
          const leftPercent = Math.max(0, Math.min(100, ((day.tempMin - globalMin) / tempSpan) * 100));
          const widthPercent = Math.max(8, Math.min(100 - leftPercent, ((day.tempMax - day.tempMin) / tempSpan) * 100));

          // Current temp dot marker on today's row
          let currentDotPercent = null;
          if (isToday && currentTemp !== undefined) {
            currentDotPercent = Math.max(0, Math.min(100, ((currentTemp - globalMin) / tempSpan) * 100));
          }

          return (
            <div
              key={day.date}
              onClick={() => toggleExpand(day.date)}
              style={{
                borderRadius: '12px',
                padding: '0 0.35rem',
                background: isToday ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                transition: 'background-color 0.15s'
              }}
            >
              <div className="apple-day-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span className="apple-day-name" style={{ color: isToday ? 'var(--accent-blue)' : '#ffffff' }}>
                    {getDayName(day.date, idx)}
                  </span>
                  {isToday && (
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      background: 'rgba(56, 189, 248, 0.2)',
                      color: 'var(--accent-blue)'
                    }}>
                      Hiện tại
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'scale(0.85)' }}>
                  {meta.icon}
                  {day.precipitationProbabilityMax > 15 && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
                      {day.precipitationProbabilityMax}%
                    </span>
                  )}
                </div>

                {/* Apple Temperature Spectrum Bar */}
                <div className="apple-temp-bar-container">
                  <span className="apple-temp-min">{displayTemp(day.tempMin)}°</span>

                  <div className="apple-spectrum-track">
                    <div
                      className="apple-spectrum-active"
                      style={{
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`
                      }}
                    />
                    {currentDotPercent !== null && (
                      <div
                        className="apple-spectrum-dot"
                        style={{ left: `${currentDotPercent}%` }}
                        title={`Hiện tại: ${displayTemp(currentTemp)}°`}
                      />
                    )}
                  </div>

                  <span className="apple-temp-max">{displayTemp(day.tempMax)}°</span>
                </div>
              </div>

              {isExpanded && (
                <div className="apple-day-expanded">
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>Thời tiết</div>
                    <strong style={{ color: '#fff' }}>{meta.label}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>Lượng mưa</div>
                    <strong style={{ color: '#fff' }}>{day.precipitationSum} mm</strong>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>Gió giật max</div>
                    <strong style={{ color: '#fff' }}>{day.windGustsMax || day.windSpeedMax} km/h</strong>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>Chỉ số UV</div>
                    <strong style={{ color: '#fbbf24' }}>{day.uvIndexMax}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>Bình minh</div>
                    <strong style={{ color: '#fff' }}>{day.sunrise?.split('T')[1]?.slice(0, 5) || '--:--'}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>Hoàng hôn</div>
                    <strong style={{ color: '#fff' }}>{day.sunset?.split('T')[1]?.slice(0, 5) || '--:--'}</strong>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Apple-style Expand / Collapse Button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <button
          className="apple-btn-pill"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            fontSize: '0.8rem',
            padding: '0.45rem 1.1rem',
            color: '#ffffff'
          }}
          onClick={() => setShowAll16Days(!showAll16Days)}
        >
          {showAll16Days ? (
            <>
              Thu gọn 8 ngày gần nhất <ChevronUp size={14} />
            </>
          ) : (
            <>
              Xem đầy đủ 16 ngày <ChevronDown size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
