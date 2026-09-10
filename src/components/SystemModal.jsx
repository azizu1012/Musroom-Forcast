import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Database, 
  Terminal, 
  Trash2, 
  X, 
  CheckCircle2, 
  Sparkles
} from 'lucide-react';

export default function SystemModal({ isOpen, onClose, onShowToast }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const json = await res.json();
        setStatus(json);
      }
    } catch (err) {
      console.error('System status error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchStatus();
  }, [isOpen]);

  const handleManualPurge = async () => {
    setPurging(true);
    try {
      const res = await fetch('/api/admin/cleanup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onShowToast(`Đã dọn dẹp: Xóa ${data.deletedCount} bản ghi quá 3 năm.`);
        fetchStatus();
      }
    } catch (err) {
      onShowToast('Lỗi khi thực hiện dọn dẹp');
    } finally {
      setPurging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="apple-brand-icon">
              <ShieldCheck size={20} color="#34d399" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                Hệ Thống & Bảo Mật
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                PulseWeather Architecture Overview
              </div>
            </div>
          </div>

          <button className="apple-btn-round" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Đang tải thông tin hệ thống...
          </div>
        ) : status ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* 1. Database & 3-Year Retention */}
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Database size={15} color="#38bdf8" /> Cơ Sở Dữ Liệu SQLite (.db)
                </span>
                <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
                  Active • {status.database?.sizeKb} KB
                </span>
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <div>Đường dẫn: <code>data/weather.db</code></div>
                <div>Địa điểm hạt giống: <strong>{status.database?.locationsCount}</strong></div>
                <div>Bản ghi snapshot: <strong>{status.database?.totalSnapshots}</strong></div>
                <div>Chu kỳ lưu trữ: <strong>3 năm</strong></div>
              </div>

              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <button
                  className="btn-apple-secondary"
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  onClick={handleManualPurge}
                  disabled={purging}
                >
                  <Trash2 size={13} color="#f87171" />
                  {purging ? 'Đang xử lý...' : 'Quét dọn dữ liệu quá 3 năm'}
                </button>
              </div>
            </div>

            {/* 2. Chroma DB */}
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={15} color="#c084fc" /> Chroma DB Vector Bridge
                </span>
                <span style={{ fontSize: '0.75rem', color: status.chromaService?.connected ? '#34d399' : '#fbbf24', fontWeight: 600 }}>
                  {status.chromaService?.connected ? 'Online' : 'Hybrid Standby'}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {status.chromaService?.message}
              </div>
            </div>

            {/* 3. Security */}
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#34d399', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldCheck size={15} /> Tiêu Chuẩn An Toàn & Bảo Vệ Người Dùng
              </div>
              <ul style={{ listStyle: 'none', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={13} color="#34d399" />
                  Reverse Proxy: Bảo vệ địa chỉ IP và headers máy khách.
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={13} color="#34d399" />
                  Helmet Protection: CSP, chống Clickjacking và MIME sniffing.
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={13} color="#34d399" />
                  Rate Limiting: Kiểm soát lưu lượng 120 req/phút.
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={13} color="#34d399" />
                  Parameter Validation: Truy vấn SQL Prepared Statements an toàn tuyệt đối.
                </li>
              </ul>
            </div>

            {/* 4. Runtime */}
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fbbf24', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Terminal size={15} /> Môi Trường Node.js Cục Bộ
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Phiên bản: <strong>{status.runtime?.nodeVersion}</strong> • Runtime: <code>.runtime/nodejs</code>
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button className="btn-apple-secondary" onClick={onClose}>
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
