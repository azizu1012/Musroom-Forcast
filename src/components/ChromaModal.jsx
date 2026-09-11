import React, { useState, useEffect } from 'react';
import { Sparkles, X, Search, Database, RefreshCw, CheckCircle, ArrowRight, Zap, CloudRain } from 'lucide-react';
import { fetchChromaStatus, syncChromaDatabase, queryChromaVector } from '../services/weatherApi';

export default function ChromaModal({ isOpen, onClose, onSelectCity }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState([]);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      if (results.length === 0) {
        handleSearch('độ ẩm cao thích hợp trồng nấm');
      }
    }
  }, [isOpen]);

  const loadStatus = async () => {
    try {
      const data = await fetchChromaStatus();
      setStatus(data);
    } catch (err) {
      console.warn('Failed to fetch Chroma status');
    }
  };

  const handleSearch = async (overrideQuery) => {
    const q = overrideQuery !== undefined ? overrideQuery : query;
    if (!q || q.trim().length === 0) return;
    setLoading(true);
    setSyncMessage('');
    try {
      const data = await queryChromaVector(q.trim(), 6);
      setResults(data.results || []);
    } catch (err) {
      console.error('Chroma query error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const data = await syncChromaDatabase();
      setSyncMessage(`Đã đồng bộ ${data.totalSynced} bản ghi thời tiết vào ChromaDB Vector!`);
      loadStatus();
    } catch (err) {
      setSyncMessage('Đồng bộ thất bại');
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  const quickSamples = [
    { label: '🍄 Trồng nấm & độ ẩm cao', q: 'độ ẩm rất cao thích hợp trồng nấm' },
    { label: '⛈️ Giông bão gió mạnh', q: 'dông bão gió giật mạnh sấm sét' },
    { label: '☀️ Nắng nóng oi bức', q: 'nắng nóng gay gắt nhiệt độ cao oi bức' },
    { label: '🌫️ Se lạnh sương mù', q: 'se lạnh sương mù ẩm ướt' }
  ];

  return (
    <div className="apple-modal-overlay" onClick={onClose}>
      <div 
        className="apple-modal-card" 
        style={{ maxWidth: '680px', width: '92%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.8rem', borderBottom: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>ChromaDB Vector AI Search</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>Tìm kiếm hình thái thời tiết bằng ngôn ngữ tự nhiên</div>
            </div>
          </div>

          <button className="apple-btn-round" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {/* Engine Status Banner */}
        <div style={{ margin: '0.8rem 0 0.5rem 0', padding: '0.6rem 0.8rem', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
            <Database size={14} color="#a855f7" />
            <span>Collection: <strong>{status?.collection || 'weather_vectors'}</strong></span>
            <span style={{ color: 'var(--text-tertiary)' }}>•</span>
            <span>Số vector: <strong>{status?.vectorCount ?? 'Đang tải...'}</strong></span>
            <span style={{ color: 'var(--text-tertiary)' }}>•</span>
            <span style={{ 
              padding: '0.1rem 0.4rem', 
              borderRadius: '4px', 
              fontSize: '0.68rem', 
              fontWeight: 600,
              background: status?.connected ? 'rgba(52, 211, 153, 0.2)' : 'rgba(56, 189, 248, 0.2)',
              color: status?.connected ? '#34d399' : '#38bdf8'
            }}>
              {status?.connected ? 'Chroma Server Online' : 'Embedded Engine WAL'}
            </span>
          </div>

          <button
            className="apple-btn-pill"
            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(255, 255, 255, 0.1)' }}
            onClick={handleSyncAll}
            disabled={syncing}
            title="Đồng bộ lại toàn bộ vector từ SQLite snapshots"
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ Vector'}
          </button>
        </div>

        {syncMessage && (
          <div style={{ fontSize: '0.74rem', color: '#34d399', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle size={12} />
            <span>{syncMessage}</span>
          </div>
        )}

        {/* Natural Language Query Input */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
          <div className="apple-search-box" style={{ flex: 1 }}>
            <Search size={14} className="apple-search-icon" />
            <input
              type="text"
              className="apple-search-input"
              placeholder="VD: độ ẩm cao trồng nấm, mưa rào gió mạnh, sương mù..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            className="apple-btn-pill"
            style={{ background: 'var(--accent-blue)', color: '#fff', padding: '0 1rem', fontSize: '0.8rem', fontWeight: 600 }}
            onClick={() => handleSearch()}
            disabled={loading}
          >
            {loading ? 'Đang phân tích...' : 'Tìm kiếm'}
          </button>
        </div>

        {/* Quick Sample Chips */}
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', padding: '0.5rem 0' }}>
          {quickSamples.map((s, idx) => (
            <button
              key={idx}
              className="apple-btn-pill"
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem', background: 'rgba(255, 255, 255, 0.08)', whiteSpace: 'nowrap' }}
              onClick={() => {
                setQuery(s.q);
                handleSearch(s.q);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.4rem', paddingRight: '2px' }}>
          {results.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              Chưa có kết quả. Nhập câu hỏi mô tả điều kiện thời tiết để tìm kiếm vector!
            </div>
          )}

          {results.map((item, idx) => (
            <div
              key={item.id || idx}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '0.7rem 0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.metadata?.city_name || 'Địa phương'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {item.metadata?.date}
                  </span>
                  {item.metadata?.temperature !== undefined && (
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                      {item.metadata.temperature}°C
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '12px',
                    background: item.similarityScore >= 80 ? 'rgba(52, 211, 153, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                    color: item.similarityScore >= 80 ? '#34d399' : '#38bdf8'
                  }}>
                    {item.similarityScore}% Tương đồng
                  </span>

                  <button
                    className="apple-btn-pill"
                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(255, 255, 255, 0.15)', color: '#fff' }}
                    onClick={() => {
                      if (onSelectCity && item.metadata?.city_name) {
                        onSelectCity(item.metadata.city_name);
                        onClose();
                      }
                    }}
                  >
                    <span>Xem vị trí</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.4 }}>
                {item.document}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
