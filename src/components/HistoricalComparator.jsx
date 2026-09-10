import React, { useEffect, useState } from 'react';
import { History, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { getWeatherMeta } from '../utils/weatherIcons';

export default function HistoricalComparator({ currentCity, lat, lon, currentTemp, unit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    if (!lat || !lon) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/weather/compare-history?lat=${lat}&lon=${lon}&city=${encodeURIComponent(currentCity || '')}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentCity, lat, lon]);

  const displayTemp = (celsius) => {
    if (celsius === undefined || celsius === null) return '--';
    if (unit === 'fahrenheit') {
      return Math.round((celsius * 9) / 5 + 32);
    }
    return Math.round(celsius);
  };

  const getDelta = (pastAvg) => {
    if (pastAvg === undefined || currentTemp === undefined) return null;
    const diff = currentTemp - pastAvg;
    return {
      value: Math.abs(diff).toFixed(1),
      isWarmer: diff > 0,
      isEqual: Math.abs(diff) < 0.2
    };
  };

  return (
    <div className="apple-widget">
      <div className="widget-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <History size={14} />
          <span>Xu Hướng Khí Hậu 3 Năm</span>
        </div>
        <button
          className="apple-btn-round"
          style={{ width: '26px', height: '26px', border: 'none', background: 'transparent' }}
          onClick={fetchHistory}
          disabled={loading}
          title="Làm mới đối chiếu"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Đang tổng hợp dữ liệu lịch sử...
        </div>
      ) : data && data.comparisons && data.comparisons.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginTop: '0.5rem' }}>
          {data.comparisons.map((item) => {
            const meta = getWeatherMeta(item.weatherCode, 1);
            const delta = getDelta(item.avgTemp);

            return (
              <div
                key={item.year}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '16px',
                  padding: '1rem',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Cùng ngày {item.year}
                  </span>
                  <div style={{ transform: 'scale(0.7)' }}>{meta.icon}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0.2rem 0' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 500 }}>
                    {displayTemp(item.avgTemp)}°
                  </span>

                  {delta && (
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        color: delta.isEqual ? 'var(--text-secondary)' : delta.isWarmer ? '#fb923c' : '#38bdf8'
                      }}
                    >
                      {delta.isEqual ? (
                        <>
                          <Minus size={12} /> Tương đương
                        </>
                      ) : delta.isWarmer ? (
                        <>
                          <TrendingUp size={12} /> +{delta.value}°
                        </>
                      ) : (
                        <>
                          <TrendingDown size={12} /> -{delta.value}°
                        </>
                      )}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  Cao {displayTemp(item.tempMax)}° • Thấp {displayTemp(item.tempMin)}°
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Đang khởi tạo chuỗi quan sát khí hậu cho khu vực này.
        </div>
      )}
    </div>
  );
}
