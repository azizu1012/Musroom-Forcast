import React, { useState } from 'react';
import { 
  Sprout, 
  Droplets, 
  Thermometer, 
  Wind, 
  Sun, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Layers, 
  Compass,
  ArrowRight
} from 'lucide-react';

export default function MushroomAgroMetrics({ forecast, unit }) {
  if (!forecast || !forecast.current) return null;

  const { current } = forecast;
  const agro = current.mushroomAgro || {
    overallScore: 85,
    status: 'Môi Trường Lý Tưởng Phát Triển Quả Thể',
    statusColor: '#34d399',
    actionAdvice: 'Khí hậu và độ ẩm đang trong vùng vàng (Golden Zone) để kích thích mầm nấm phát triển mọc rộ.',
    vpdStatus: 'Tối ưu (0.3 - 0.7 kPa)',
    species: []
  };

  const [selectedSpeciesIndex, setSelectedSpeciesIndex] = useState(0);

  const displayTemp = (celsius) => {
    if (celsius === undefined || celsius === null) return '--';
    if (unit === 'fahrenheit') {
      return Math.round((celsius * 9) / 5 + 32) + '°F';
    }
    return Math.round(celsius) + '°C';
  };

  // VPD indicator pointer (0 to 2.0 kPa)
  const vpdVal = current.vpd ?? 0.75;
  const vpdPercent = Math.min(100, Math.max(0, (vpdVal / 1.8) * 100));

  // Soil Moisture values
  const sm0_1 = current.soilMoisture0To1cm ?? 32.5;
  const sm1_3 = current.soilMoisture1To3cm ?? 34.0;
  const sm3_9 = current.soilMoisture3To9cm ?? 35.5;
  const sm9_27 = current.soilMoisture9To27cm ?? 37.0;

  const selectedSpecies = agro.species?.[selectedSpeciesIndex] || agro.species?.[0];

  return (
    <div className="mushroom-agro-section">
      {/* Section Header */}
      <div className="mushroom-section-header">
        <div className="mushroom-header-left">
          <div className="mushroom-header-badge">
            <Sprout size={18} color="#34d399" />
          </div>
          <div>
            <h3 className="mushroom-section-title">Chỉ Số Khí Hậu Trồng Nấm & Nông Nghiệp Đất</h3>
            <p className="mushroom-section-desc">
              Phân tích độ ẩm không khí, độ ẩm 4 tầng đất, nhiệt độ cơ chất và áp suất hơi thiếu hụt (VPD)
            </p>
          </div>
        </div>

        <div 
          className="mushroom-score-pill"
          style={{
            borderColor: agro.statusColor,
            background: `${agro.statusColor}18`
          }}
        >
          <div className="mushroom-score-num" style={{ color: agro.statusColor }}>
            {agro.overallScore}<span>/100</span>
          </div>
          <div className="mushroom-score-text">
            <span style={{ color: agro.statusColor }}>● {agro.status}</span>
          </div>
        </div>
      </div>

      {/* Action Advisory Alert */}
      <div className="mushroom-advisory-card">
        <div className="mushroom-advisory-icon">
          <Info size={18} color="#38bdf8" />
        </div>
        <div className="mushroom-advisory-content">
          <div className="mushroom-advisory-title">Khuyến Nghị Chăm Sóc Trại Nấm Trực Tiếp:</div>
          <div className="mushroom-advisory-body">{agro.actionAdvice}</div>
        </div>
      </div>

      {/* Primary Agro Grid */}
      <div className="mushroom-grid">
        {/* 1. VPD Gauge (Vapor Pressure Deficit) */}
        <div className="apple-widget mushroom-card">
          <div className="widget-header">
            <Wind size={14} color="#38bdf8" />
            <span>Áp Suất Hơi Thiếu Hụt (VPD)</span>
          </div>

          <div className="widget-main-value" style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            {vpdVal} <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>kPa</span>
          </div>

          <div className="widget-subtitle" style={{ color: vpdVal >= 0.3 && vpdVal <= 0.75 ? '#34d399' : (vpdVal > 0.75 ? '#fb923c' : '#38bdf8') }}>
            {agro.vpdStatus}
          </div>

          {/* VPD Spectrum Bar */}
          <div className="vpd-track-container">
            <div className="vpd-track">
              <div className="vpd-zone vpd-zone-wet" title="< 0.3 kPa: Ẩm bão hòa / Đọng sương">Bão Hòa</div>
              <div className="vpd-zone vpd-zone-ideal" title="0.3 - 0.75 kPa: Vùng vàng cho nấm">Lý Tưởng</div>
              <div className="vpd-zone vpd-zone-dry" title="> 0.75 kPa: Khô bốc hơi">Khô Hạn</div>
            </div>
            <div className="vpd-needle" style={{ left: `${vpdPercent}%` }} />
          </div>

          <div className="widget-footer-note" style={{ marginTop: '0.8rem' }}>
            {vpdVal <= 0.25 
              ? 'VPD quá thấp: Nước bốc hơi chậm, đọng giọt trên tai nấm gây nguy cơ thối nhũn.'
              : (vpdVal <= 0.75 
                ? 'VPD vàng: Nấm bốc thoát hơi nước cân bằng, hấp thu dưỡng chất cơ chất tối ưu.'
                : 'VPD cao: Nước bốc hơi nhanh, cần tăng cường phun sương mịn giữ ẩm mũ nấm.')}
          </div>
        </div>

        {/* 2. Soil Moisture Multi-Layer Inspector */}
        <div className="apple-widget mushroom-card">
          <div className="widget-header">
            <Droplets size={14} color="#34d399" />
            <span>Độ Ẩm Đất & Cơ Chất (4 Tầng Sâu)</span>
          </div>

          <div className="soil-layers-list">
            <div className="soil-layer-row">
              <div className="soil-layer-info">
                <span className="soil-layer-name">Tầng Mặt (0 - 1 cm)</span>
                <span className="soil-layer-note">Mặt luống rơm / bịch phôi</span>
              </div>
              <div className="soil-layer-bar-wrap">
                <div className="soil-layer-bar" style={{ width: `${Math.min(100, sm0_1 * 2)}%`, background: '#38bdf8' }} />
              </div>
              <span className="soil-layer-val">{sm0_1}%</span>
            </div>

            <div className="soil-layer-row">
              <div className="soil-layer-info">
                <span className="soil-layer-name">Tầng Cơ Chất (1 - 3 cm)</span>
                <span className="soil-layer-note">Tầng tơ nấm hút nước</span>
              </div>
              <div className="soil-layer-bar-wrap">
                <div className="soil-layer-bar" style={{ width: `${Math.min(100, sm1_3 * 2)}%`, background: '#34d399' }} />
              </div>
              <span className="soil-layer-val">{sm1_3}%</span>
            </div>

            <div className="soil-layer-row">
              <div className="soil-layer-info">
                <span className="soil-layer-name">Tầng Sinh Dưỡng (3 - 9 cm)</span>
                <span className="soil-layer-note">Túi ẩm nền phôi</span>
              </div>
              <div className="soil-layer-bar-wrap">
                <div className="soil-layer-bar" style={{ width: `${Math.min(100, sm3_9 * 2)}%`, background: '#10b981' }} />
              </div>
              <span className="soil-layer-val">{sm3_9}%</span>
            </div>

            <div className="soil-layer-row">
              <div className="soil-layer-info">
                <span className="soil-layer-name">Tầng Đất Sâu (9 - 27 cm)</span>
                <span className="soil-layer-note">Độ ẩm lưu trữ tự nhiên</span>
              </div>
              <div className="soil-layer-bar-wrap">
                <div className="soil-layer-bar" style={{ width: `${Math.min(100, sm9_27 * 2)}%`, background: '#6ee7b7' }} />
              </div>
              <span className="soil-layer-val">{sm9_27}%</span>
            </div>
          </div>

          <div className="widget-footer-note" style={{ marginTop: '0.6rem' }}>
            Ẩm độ cơ chất trung bình: <strong style={{ color: '#fff' }}>{((sm0_1 + sm1_3) / 2).toFixed(1)}% vol</strong> (Ngưỡng vàng: 28% - 40%).
          </div>
        </div>

        {/* 3. Substrate Soil Temp vs Ambient Temp */}
        <div className="apple-widget mushroom-card">
          <div className="widget-header">
            <Thermometer size={14} color="#fb923c" />
            <span>Nhiệt Độ Cơ Chất Đất vs Không Khí</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginTop: '0.5rem' }}>
            <div className="temp-metric-box">
              <div className="temp-box-label">Bề Mặt Cơ Chất (0cm)</div>
              <div className="temp-box-val" style={{ color: '#fb923c' }}>
                {displayTemp(current.soilTemperature0cm)}
              </div>
              <div className="temp-box-sub">Tác động mầm quả thể</div>
            </div>

            <div className="temp-metric-box">
              <div className="temp-box-label">Tầng Sâu (6cm)</div>
              <div className="temp-box-val" style={{ color: '#34d399' }}>
                {displayTemp(current.soilTemperature6cm)}
              </div>
              <div className="temp-box-sub">Vùng nuôi mạng sợi tơ</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '0.8rem', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Nhiệt độ không khí:</span>
            <strong style={{ color: '#fff' }}>{displayTemp(current.temperature)}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Điểm sương (Dew Point):</span>
            <strong style={{ color: '#38bdf8' }}>{displayTemp(current.dewPoint)}</strong>
          </div>

          <div className="widget-footer-note" style={{ marginTop: '0.6rem' }}>
            Chênh lệch nhiệt độ - điểm sương: <strong style={{ color: '#fff' }}>{(current.temperature - current.dewPoint).toFixed(1)}°C</strong>.
            {current.temperature - current.dewPoint > 3 
              ? ' An toàn, không có nguy cơ đọng sương làm thối mũ nấm.'
              : ' Cảnh báo: Nhiệt độ gần điểm sương, rất dễ ngưng tụ ẩm thối nhũn!'}
          </div>
        </div>

        {/* 4. Evapotranspiration & Solar Radiation */}
        <div className="apple-widget mushroom-card">
          <div className="widget-header">
            <Sun size={14} color="#fbbf24" />
            <span>Bốc Thoát Hơi Nước & Bức Xạ Nắng</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginTop: '0.5rem' }}>
            <div className="temp-metric-box">
              <div className="temp-box-label">Tốc Độ Bốc Hơi (ET₀)</div>
              <div className="temp-box-val" style={{ color: '#38bdf8' }}>
                {current.evapotranspiration ?? 0.25} <span style={{ fontSize: '0.9rem' }}>mm/h</span>
              </div>
              <div className="temp-box-sub">Tiêu chuẩn FAO</div>
            </div>

            <div className="temp-metric-box">
              <div className="temp-box-label">Bức Xạ Mặt Trời</div>
              <div className="temp-box-val" style={{ color: '#fbbf24' }}>
                {current.solarRadiation ?? 220} <span style={{ fontSize: '0.9rem' }}>W/m²</span>
              </div>
              <div className="temp-box-sub">Quang kỳ nấm</div>
            </div>
          </div>

          <div className="widget-footer-note" style={{ marginTop: '0.8rem' }}>
            {current.solarRadiation > 350
              ? 'Nắng gắt ngoài trời. Cần phủ kín lưới lan che nắng 70-80% để tơ nấm không bị sốc nhiệt.'
              : 'Bức xạ khuếch tán dịu, lý tưởng cho giai đoạn phân hóa mầm nấm và lên màu mũ nấm.'}
          </div>
        </div>
      </div>

      {/* 5. Species Compatibility Hub (5 Vietnam Popular Species) */}
      <div className="mushroom-species-section">
        <div className="mushroom-species-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🍄</span>
            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Tương Thích 5 Giống Nấm Phổ Biến Tại Việt Nam</h4>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            Dựa trên vi khí hậu thời gian thực tại địa phương
          </span>
        </div>

        {/* Species selector pills */}
        <div className="mushroom-species-pills">
          {agro.species?.map((item, idx) => (
            <button
              key={item.name}
              className={`species-pill-btn ${selectedSpeciesIndex === idx ? 'active' : ''}`}
              onClick={() => setSelectedSpeciesIndex(idx)}
            >
              <span>{item.name}</span>
              <span className="species-pill-score" style={{ color: item.score >= 80 ? '#34d399' : (item.score >= 60 ? '#fbbf24' : '#f87171') }}>
                {item.score}%
              </span>
            </button>
          ))}
        </div>

        {/* Selected Species Detail Card */}
        {selectedSpecies && (
          <div className="species-detail-card">
            <div className="species-detail-top">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h4 className="species-name">{selectedSpecies.name}</h4>
                  <span className="species-sci">({selectedSpecies.scientific})</span>
                </div>
                <div className="species-tag" style={{ color: selectedSpecies.score >= 80 ? '#34d399' : '#fbbf24' }}>
                  ● {selectedSpecies.suitability}
                </div>
              </div>

              <div className="species-score-circle">
                <span className="species-score-val">{selectedSpecies.score}</span>
                <span className="species-score-pct">%</span>
              </div>
            </div>

            <div className="species-requirements-grid">
              <div className="species-req-item">
                <span className="req-label">Nhiệt độ tối ưu:</span>
                <strong className="req-val">{selectedSpecies.optTemp}</strong>
              </div>
              <div className="species-req-item">
                <span className="req-label">Độ ẩm không khí:</span>
                <strong className="req-val">{selectedSpecies.optHumidity}</strong>
              </div>
              <div className="species-req-item">
                <span className="req-label">Độ ẩm cơ chất:</span>
                <strong className="req-val">{selectedSpecies.optMoist}</strong>
              </div>
            </div>

            <div className="species-note-box">
              <strong style={{ color: '#fff' }}>Kỹ thuật nuôi trồng: </strong>
              <span>{selectedSpecies.note}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
