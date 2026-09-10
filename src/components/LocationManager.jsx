import React, { useState, useMemo } from 'react';
import { 
  Bookmark, 
  Trash2, 
  Edit3, 
  Heart, 
  MapPin, 
  Search, 
  X,
  Plus,
  Globe,
  Loader2
} from 'lucide-react';
import { createFuzzySearchEngine, removeVietnameseTones } from '../utils/searchEngine';

export default function LocationManager({
  locations,
  activeLocation,
  onSelectLocation,
  onAddLocation,
  onUpdateLocation,
  onDeleteLocation
}) {
  const [filterRegion, setFilterRegion] = useState('all'); // 'all' | 'hcm' | 'hanoi' | 'north' | 'central' | 'south'
  const [searchTerm, setSearchTerm] = useState('');
  const [editingLoc, setEditingLoc] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Online Geocoding Search state (for finding any ward/commune in Vietnam)
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineResults, setOnlineResults] = useState([]);
  const [hasSearchedOnline, setHasSearchedOnline] = useState(false);

  // New location form state
  const [newLocForm, setNewLocForm] = useState({
    name: '',
    latitude: '',
    longitude: '',
    admin1: 'TP. Hồ Chí Minh',
    custom_label: 'Yêu thích',
    notes: ''
  });

  // Edit form state
  const [formData, setFormData] = useState({
    custom_label: '',
    notes: '',
    alert_rain_threshold: 60,
    is_favorite: 0
  });

  // Region Counts
  const counts = useMemo(() => {
    return {
      all: locations.length,
      hcm: locations.filter((loc) => loc.region === 'TP.HCM' || loc.admin1?.includes('Hồ Chí Minh') || loc.admin1?.includes('Thủ Đức')).length,
      hanoi: locations.filter((loc) => loc.region === 'Hà Nội' || loc.admin1?.includes('Hà Nội')).length,
      north: locations.filter((loc) => loc.region === 'Miền Bắc').length,
      central: locations.filter((loc) => loc.region === 'Miền Trung').length,
      south: locations.filter((loc) => loc.region === 'Miền Nam').length,
    };
  }, [locations]);

  // 1. Build Fuse.js instance with enhanced typo tolerance & Vietnamese phonetics
  const fuzzyEngine = useMemo(() => {
    return createFuzzySearchEngine(locations);
  }, [locations]);

  // 2. Compute filtered & fuzzy-searched locations
  const displayedLocations = useMemo(() => {
    // If search term is present, perform fuzzy search
    let list = searchTerm.trim().length > 0 
      ? fuzzyEngine.search(searchTerm) 
      : locations;

    // Apply region tabs
    if (filterRegion === 'hcm') {
      list = list.filter((loc) => loc.region === 'TP.HCM' || loc.admin1?.includes('Hồ Chí Minh') || loc.admin1?.includes('Thủ Đức'));
    } else if (filterRegion === 'hanoi') {
      list = list.filter((loc) => loc.region === 'Hà Nội' || loc.admin1?.includes('Hà Nội'));
    } else if (filterRegion === 'north') {
      list = list.filter((loc) => loc.region === 'Miền Bắc');
    } else if (filterRegion === 'central') {
      list = list.filter((loc) => loc.region === 'Miền Trung');
    } else if (filterRegion === 'south') {
      list = list.filter((loc) => loc.region === 'Miền Nam');
    }

    return list;
  }, [searchTerm, filterRegion, fuzzyEngine, locations]);

  // Handle Online Search for any ward/commune in Vietnam
  const handleSearchOnline = async () => {
    if (!searchTerm || searchTerm.trim().length < 2) return;
    setIsSearchingOnline(true);
    setHasSearchedOnline(true);
    try {
      const res = await fetch(`/api/weather/search?q=${encodeURIComponent(searchTerm.trim())}`);
      if (!res.ok) throw new Error('Tìm kiếm trực tuyến thất bại');
      const data = await res.json();
      setOnlineResults(data);
    } catch (err) {
      console.error('[ONLINE SEARCH]', err);
      setOnlineResults([]);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleSelectOnlineResult = async (item) => {
    await onAddLocation({
      name: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
      country: 'Vietnam',
      admin1: item.admin1 || 'Việt Nam',
      region: item.region || 'Miền Nam',
      custom_label: 'Bản đồ VN',
      notes: item.display_name || ''
    });
    setOnlineResults([]);
    setHasSearchedOnline(false);
    setSearchTerm('');
  };

  const handleOpenEdit = (loc, e) => {
    e.stopPropagation();
    setEditingLoc(loc);
    setFormData({
      custom_label: loc.custom_label || '',
      notes: loc.notes || '',
      alert_rain_threshold: loc.alert_rain_threshold || 60,
      is_favorite: loc.is_favorite || 0
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingLoc) return;

    await onUpdateLocation(editingLoc.id, {
      custom_label: formData.custom_label,
      notes: formData.notes,
      alert_rain_threshold: parseInt(formData.alert_rain_threshold, 10) || 60,
      is_favorite: formData.is_favorite ? 1 : 0
    });

    setEditingLoc(null);
  };

  const handleSaveNewLocation = async (e) => {
    e.preventDefault();
    if (!newLocForm.name || !newLocForm.latitude || !newLocForm.longitude) return;

    await onAddLocation({
      name: newLocForm.name,
      latitude: parseFloat(newLocForm.latitude),
      longitude: parseFloat(newLocForm.longitude),
      country: 'Vietnam',
      admin1: newLocForm.admin1,
      custom_label: newLocForm.custom_label,
      notes: newLocForm.notes
    });

    setIsAddModalOpen(false);
    setNewLocForm({ name: '', latitude: '', longitude: '', admin1: 'TP. Hồ Chí Minh', custom_label: 'Yêu thích', notes: '' });
  };

  return (
    <aside className="apple-sidebar-pane">
      {/* Sidebar Header with Fuzzy Search & Filters */}
      <div className="apple-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Bookmark size={15} color="var(--accent-blue)" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Địa Điểm Đã Lưu</span>
          </div>

          <button
            className="apple-btn-round"
            style={{ width: '28px', height: '28px' }}
            onClick={() => setIsAddModalOpen(true)}
            title="Thêm địa điểm tùy chỉnh"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Typo-tolerant Fuzzy Search Box */}
        <div className="apple-search-box">
          <Search size={14} className="apple-search-icon" />
          <input
            type="text"
            className="apple-search-input"
            placeholder="Tìm phường, quận, tỉnh thành (nhận diện gõ sai)..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setHasSearchedOnline(false);
              setOnlineResults([]);
            }}
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setHasSearchedOnline(false);
                setOnlineResults([]);
              }}
              style={{
                position: 'absolute',
                right: '0.65rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer'
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Region Filter Pills */}
        <div style={{ display: 'flex', gap: '0.3rem', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { id: 'all', label: `Tất cả (${counts.all})` },
            { id: 'hcm', label: `TP.HCM (${counts.hcm})` },
            { id: 'hanoi', label: `Hà Nội (${counts.hanoi})` },
            { id: 'north', label: `Miền Bắc (${counts.north})` },
            { id: 'central', label: `Miền Trung (${counts.central})` },
            { id: 'south', label: `Miền Nam (${counts.south})` }
          ].map((tab) => (
            <button
              key={tab.id}
              className="apple-btn-pill"
              style={{
                background: filterRegion === tab.id ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                borderColor: filterRegion === tab.id ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.1)',
                fontSize: '0.72rem',
                padding: '0.22rem 0.55rem',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setFilterRegion(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Location Cards List */}
      <div className="sidebar-scroll-list">
        {/* Dynamic Online Geocoding Search option for any ward/commune in Vietnam */}
        {searchTerm.trim().length >= 2 && (
          <div style={{
            padding: '0.5rem 0.65rem',
            background: 'rgba(56, 189, 248, 0.08)',
            borderRadius: '10px',
            border: '1px solid rgba(56, 189, 248, 0.22)',
            marginBottom: '0.65rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
                <Globe size={13} />
                <span>Bản Đồ Mở Rộng Việt Nam</span>
              </div>
              <button
                className="apple-btn-pill"
                style={{
                  fontSize: '0.7rem',
                  padding: '0.22rem 0.55rem',
                  background: 'var(--accent-blue)',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  cursor: 'pointer'
                }}
                onClick={handleSearchOnline}
                disabled={isSearchingOnline}
              >
                {isSearchingOnline ? <Loader2 size={11} className="apple-spinner" /> : <Search size={11} />}
                <span>Tìm trực tuyến</span>
              </button>
            </div>

            {hasSearchedOnline && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {isSearchingOnline
                  ? 'Đang tra cứu tọa độ toàn quốc...'
                  : onlineResults.length === 0
                  ? `Không tìm thấy thêm xã/phường cho "${searchTerm}"`
                  : `Tìm thấy ${onlineResults.length} địa điểm trên bản đồ Việt Nam:`}
              </div>
            )}

            {onlineResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '140px', overflowY: 'auto' }}>
                {onlineResults.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.35rem 0.5rem',
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleSelectOnlineResult(item)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '75%' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.admin1 || item.display_name}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--accent-blue)', fontWeight: 600 }}>+ Lưu</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {displayedLocations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            Không tìm thấy địa điểm trong danh mục có sẵn với "{searchTerm}".
            <div style={{ marginTop: '0.4rem', fontSize: '0.75rem' }}>
              Hãy bấm <strong>Tìm trực tuyến</strong> ở trên để tra cứu tức thì trên toàn bộ bản đồ Việt Nam!
            </div>
          </div>
        ) : (
          displayedLocations.map((loc) => {
            const isActive = activeLocation && activeLocation.name === loc.name;

            return (
              <div
                key={loc.id}
                className={`apple-saved-card ${isActive ? 'active' : ''}`}
                onClick={() => onSelectLocation(loc)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className="saved-card-name">{loc.name}</span>
                    {loc.is_favorite === 1 && (
                      <Heart size={12} fill="#f43f5e" color="#f43f5e" />
                    )}
                    {loc.custom_label && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8'
                        }}
                      >
                        {loc.custom_label}
                      </span>
                    )}
                  </div>

                  <div className="saved-card-sub">
                    <MapPin size={10} style={{ display: 'inline', marginRight: '2px' }} />
                    {loc.admin1}
                    {loc.notes ? ` • "${loc.notes}"` : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button
                    className="apple-btn-round"
                    style={{ width: '28px', height: '28px', border: 'none', background: 'transparent' }}
                    onClick={(e) => handleOpenEdit(loc, e)}
                    title="Chỉnh sửa ghi chú"
                  >
                    <Edit3 size={13} color="rgba(255, 255, 255, 0.6)" />
                  </button>

                  <button
                    className="apple-btn-round"
                    style={{ width: '28px', height: '28px', border: 'none', background: 'transparent' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Xác nhận xóa '${loc.name}' khỏi danh sách?`)) {
                        onDeleteLocation(loc.id);
                      }
                    }}
                    title="Xóa"
                  >
                    <Trash2 size={13} color="rgba(248, 113, 113, 0.7)" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* EDIT LOCATION MODAL */}
      {editingLoc && (
        <div className="modal-overlay" onClick={() => setEditingLoc(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>
                Tùy Chỉnh: {editingLoc.name}
              </h3>
              <button
                className="apple-btn-round"
                style={{ width: '30px', height: '30px' }}
                onClick={() => setEditingLoc(null)}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Nhãn vị trí (VD: Nhà riêng, Cơ quan, Du lịch...)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.custom_label}
                  onChange={(e) => setFormData({ ...formData, custom_label: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Ghi chú
                </label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Ngưỡng cảnh báo mưa (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-input"
                  value={formData.alert_rain_threshold}
                  onChange={(e) => setFormData({ ...formData, alert_rain_threshold: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input
                  type="checkbox"
                  id="favCheck"
                  checked={formData.is_favorite === 1}
                  onChange={(e) => setFormData({ ...formData, is_favorite: e.target.checked ? 1 : 0 })}
                />
                <label htmlFor="favCheck" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Đặt làm địa điểm ưu tiên
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-apple-secondary" onClick={() => setEditingLoc(null)}>
                  Hủy
                </button>
                <button type="submit" className="btn-apple-primary">
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD LOCATION MODAL */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Thêm Vị Trí Mới</h3>
              <button
                className="apple-btn-round"
                style={{ width: '30px', height: '30px' }}
                onClick={() => setIsAddModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveNewLocation}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Tên địa điểm
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Côn Đảo"
                  className="form-input"
                  value={newLocForm.name}
                  onChange={(e) => setNewLocForm({ ...newLocForm, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Vĩ độ (Lat)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="10.77"
                    className="form-input"
                    value={newLocForm.latitude}
                    onChange={(e) => setNewLocForm({ ...newLocForm, latitude: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Kinh độ (Lon)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="106.70"
                    className="form-input"
                    value={newLocForm.longitude}
                    onChange={(e) => setNewLocForm({ ...newLocForm, longitude: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Khu vực / Tỉnh
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={newLocForm.admin1}
                  onChange={(e) => setNewLocForm({ ...newLocForm, admin1: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn-apple-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-apple-primary">
                  Lưu Vào Danh Sách
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
