import React from 'react';
import { getWeatherMeta } from '../utils/weatherIcons';
import { Clock } from 'lucide-react';

export default function HourlySlider({ hourly24, unit }) {
  if (!hourly24 || hourly24.length === 0) return null;

  const displayTemp = (celsius) => {
    if (celsius === undefined || celsius === null) return '--';
    if (unit === 'fahrenheit') {
      return Math.round((celsius * 9) / 5 + 32);
    }
    return Math.round(celsius);
  };

  const formatHour = (isoString, idx) => {
    if (idx === 0) return 'Bây giờ';
    if (!isoString) return '';
    const parts = isoString.split('T');
    if (parts[1]) {
      return parts[1].slice(0, 5);
    }
    return isoString;
  };

  return (
    <div className="apple-widget">
      <div className="widget-header">
        <Clock size={14} />
        <span>Dự Báo Theo Giờ</span>
      </div>

      <div className="apple-hourly-list">
        {hourly24.map((item, idx) => {
          const meta = getWeatherMeta(item.weatherCode, 1);
          return (
            <div key={idx} className="apple-hourly-item">
              <span className="apple-hourly-time">
                {formatHour(item.time, idx)}
              </span>

              <div style={{ transform: 'scale(0.85)' }}>
                {meta.icon}
              </div>

              <span className="apple-hourly-temp">
                {displayTemp(item.temperature)}°
              </span>

              <span className="apple-hourly-pop">
                {item.precipitationProbability > 0 ? `${item.precipitationProbability}%` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
