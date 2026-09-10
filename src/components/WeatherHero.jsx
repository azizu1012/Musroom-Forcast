import React from 'react';
import { getWeatherMeta } from '../utils/weatherIcons';
import { Heart, Tag, ArrowUp, ArrowDown } from 'lucide-react';

export default function WeatherHero({ forecast, locationMeta, unit, onToggleFavorite }) {
  if (!forecast || !forecast.current) return null;

  const { current, daily16, city } = forecast;
  const meta = getWeatherMeta(current.weathercode, current.is_day);

  const displayTemp = (celsius) => {
    if (celsius === undefined || celsius === null) return '--';
    if (unit === 'fahrenheit') {
      return Math.round((celsius * 9) / 5 + 32);
    }
    return Math.round(celsius);
  };

  const todayMax = daily16?.[0]?.tempMax ?? current.temperature;
  const todayMin = daily16?.[0]?.tempMin ?? current.temperature;

  return (
    <div className="apple-hero">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <h1 className="apple-hero-city">{city}</h1>
        {locationMeta && (
          <button
            className="apple-btn-round"
            style={{ width: '30px', height: '30px', border: 'none', background: 'transparent' }}
            onClick={() => onToggleFavorite && onToggleFavorite(locationMeta)}
            title={locationMeta.is_favorite ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
          >
            <Heart
              size={18}
              fill={locationMeta.is_favorite ? '#f43f5e' : 'none'}
              color={locationMeta.is_favorite ? '#f43f5e' : 'rgba(255, 255, 255, 0.6)'}
            />
          </button>
        )}
      </div>

      <div className="apple-hero-province">
        {locationMeta?.admin1 ? `${locationMeta.admin1}` : 'Việt Nam'}
        {locationMeta?.custom_label && ` • ${locationMeta.custom_label}`}
      </div>

      <div className="apple-hero-temp">
        {displayTemp(current.temperature)}°
      </div>

      <div className="apple-hero-condition">
        {meta.label}
      </div>

      <div className="apple-hero-range">
        <span>C: {displayTemp(todayMax)}°</span>
        <span style={{ opacity: 0.4 }}>•</span>
        <span>T: {displayTemp(todayMin)}°</span>
      </div>

      {locationMeta?.notes && (
        <div style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: '0.4rem', fontStyle: 'italic' }}>
          "{locationMeta.notes}"
        </div>
      )}
    </div>
  );
}
