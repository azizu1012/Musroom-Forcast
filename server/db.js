import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// On Vercel Serverless, only /tmp is writable
const isVercel = Boolean(process.env.VERCEL);
const dataDir = isVercel ? '/tmp' : path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {}
}

export const dbPath = path.join(dataDir, 'weather.db');

// Load node:sqlite DatabaseSync or provide in-memory fallback
let DatabaseSync;
try {
  const sqliteModule = await import('node:sqlite');
  DatabaseSync = sqliteModule.DatabaseSync;
} catch (err) {
  console.warn('[SQLITE] Native node:sqlite not supported in this runtime, using memory fallback');
}

class MemoryDbFallback {
  constructor() {
    this.locations = [];
    this.snapshots = [];
    this.chromaVectors = [];
    this.retentionLogs = [];
    this._nextLocId = 1;
    this._nextSnapId = 1;
  }
  exec(sql) {}
  prepare(sql) {
    const s = sql.trim().toLowerCase();
    const self = this;
    return {
      run(...args) {
        if (s.startsWith('insert into locations')) {
          const newLoc = {
            id: self._nextLocId++,
            name: args[0],
            latitude: args[1],
            longitude: args[2],
            country: 'Vietnam',
            admin1: args[3] || '',
            region: args[4] || '',
            timezone: 'Asia/Ho_Chi_Minh',
            custom_label: args[5] || '',
            notes: '',
            temp_unit: 'celsius',
            alert_rain_threshold: 60,
            is_favorite: args[6] || 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          self.locations.push(newLoc);
          return { changes: 1, lastInsertRowid: newLoc.id };
        }
        if (s.startsWith('update locations set is_favorite = 1 where name =')) {
          const match = sql.match(/where name = '([^']+)'/i);
          const targetName = match ? match[1] : 'Phường Bến Nghé';
          self.locations.forEach(l => {
            if (l.name === targetName) l.is_favorite = 1;
          });
          return { changes: 1 };
        }
        if (s.startsWith('update locations')) {
          return { changes: 1 };
        }
        if (s.startsWith('delete from locations')) {
          const id = args[0];
          self.locations = self.locations.filter(l => l.id !== id);
          return { changes: 1 };
        }
        if (s.startsWith('insert into weather_snapshots')) {
          const snap = { id: self._nextSnapId++, recorded_at: new Date().toISOString() };
          self.snapshots.push(snap);
          return { changes: 1, lastInsertRowid: snap.id };
        }
        return { changes: 1, lastInsertRowid: Date.now() };
      },
      get(...args) {
        if (s.includes('count(*)')) return { count: self.locations.length, c: self.locations.length };
        if (s.includes('from locations where name =') || s.includes('where name = ?')) {
          const name = args[0];
          return self.locations.find(l => l.name === name) || null;
        }
        if (s.includes('from locations')) return self.locations[0] || null;
        if (s.includes('from weather_snapshots')) {
          return self.snapshots[self.snapshots.length - 1] || null;
        }
        return null;
      },
      all(...args) {
        if (s.includes('from locations')) {
          return [...self.locations];
        }
        if (s.includes('from weather_snapshots')) {
          return [...self.snapshots];
        }
        return [];
      }
    };
  }
}

export const db = DatabaseSync ? new DatabaseSync(dbPath) : new MemoryDbFallback();

// Enable WAL mode for high concurrency and performance
try {
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);
} catch (e) {}

// Schema Definition
db.exec(`
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    country TEXT DEFAULT 'Vietnam',
    admin1 TEXT DEFAULT '',
    region TEXT DEFAULT '',
    timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
    custom_label TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    temp_unit TEXT DEFAULT 'celsius',
    alert_rain_threshold INTEGER DEFAULT 60,
    is_favorite INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS weather_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER,
    city_name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    recorded_at TEXT DEFAULT (datetime('now')),
    date TEXT NOT NULL,
    temperature REAL,
    temp_max REAL,
    temp_min REAL,
    weather_code INTEGER,
    precipitation_probability INTEGER,
    precipitation_sum REAL,
    wind_speed REAL,
    uv_index REAL,
    humidity REAL,
    source TEXT DEFAULT 'open-meteo',
    FOREIGN KEY(location_id) REFERENCES locations(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_date ON weather_snapshots(date);
  CREATE INDEX IF NOT EXISTS idx_snapshots_recorded_at ON weather_snapshots(recorded_at);
  CREATE INDEX IF NOT EXISTS idx_snapshots_location ON weather_snapshots(location_id);

  CREATE TABLE IF NOT EXISTS retention_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    executed_at TEXT DEFAULT (datetime('now')),
    deleted_count INTEGER DEFAULT 0,
    remaining_count INTEGER DEFAULT 0,
    message TEXT
  );
`);

// Migration safeguard for column region
try {
  db.exec(`ALTER TABLE locations ADD COLUMN region TEXT DEFAULT '';`);
} catch (err) {}


// =========================================================================
// TOÀN BỘ 63 TỈNH THÀNH & HỆ THỐNG PHƯỜNG HÀNH CHÍNH TRỌNG ĐIỂM VIỆT NAM
// =========================================================================
export const VIETNAM_PROVINCES_AND_HUBS = [
  // =========================================================================
  // 1. TP. HỒ CHÍ MINH - CÁC PHƯỜNG & KHU ĐÔ THỊ TRỌNG ĐIỂM
  // =========================================================================
  // --- Khu vực Trung tâm (Quận 1 cũ) ---
  { name: 'Phường Bến Nghé', lat: 10.7769, lon: 106.7009, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'UBND TP.HCM / Phố đi bộ', fav: 1 },
  { name: 'Phường Bến Thành', lat: 10.7719, lon: 106.6983, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Chợ Bến Thành', fav: 0 },
  { name: 'Phường Đa Kao', lat: 10.7917, lon: 106.6975, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Đa Kao / Kênh Nhiêu Lộc', fav: 0 },
  { name: 'Phường Tân Định', lat: 10.7906, lon: 106.6914, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Nhà thờ Tân Định', fav: 0 },
  { name: 'Phường Phạm Ngũ Lão', lat: 10.7675, lon: 106.6925, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Phố Tây Bùi Viện', fav: 0 },
  { name: 'Phường Cầu Ông Lãnh', lat: 10.7633, lon: 106.6980, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Cầu Ông Lãnh', fav: 0 },
  { name: 'Phường Nguyễn Thái Bình', lat: 10.7702, lon: 106.7018, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Phố Tài Chính', fav: 0 },
  { name: 'Phường Cô Giang', lat: 10.7600, lon: 106.6917, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Cô Giang', fav: 0 },
  { name: 'Phường Cầu Kho', lat: 10.7558, lon: 106.6872, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Cầu Kho', fav: 0 },
  { name: 'Phường Nguyễn Cư Trinh', lat: 10.7639, lon: 106.6853, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Nguyễn Cư Trinh', fav: 0 },

  // --- Khu vực Quận 3 cũ ---
  { name: 'Phường Võ Thị Sáu', lat: 10.7850, lon: 106.6931, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Hồ Con Rùa / Bảo tàng', fav: 0 },
  { name: 'Phường 1 (Quận 3)', lat: 10.7708, lon: 106.6833, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Lý Thái Tổ', fav: 0 },
  { name: 'Phường 2 (Quận 3)', lat: 10.7680, lon: 106.6810, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Nguyễn Đình Chiểu', fav: 0 },
  { name: 'Phường 4 (Quận 3)', lat: 10.7745, lon: 106.6850, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Vườn Chuối', fav: 0 },
  { name: 'Phường 9 (Quận 3)', lat: 10.7810, lon: 106.6830, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Ga Sài Gòn', fav: 0 },
  { name: 'Phường 11 (Quận 3)', lat: 10.7840, lon: 106.6780, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Kỳ Đồng', fav: 0 },

  // --- Khu vực Thành phố Thủ Đức ---
  { name: 'Phường Thảo Điền', lat: 10.8037, lon: 106.7324, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Bán đảo Thảo Điền', fav: 0 },
  { name: 'Phường An Phú', lat: 10.7963, lon: 106.7511, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Mega Market / Masteri', fav: 0 },
  { name: 'Phường An Khánh', lat: 10.7878, lon: 106.7269, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Khu Đô Thị An Khánh', fav: 0 },
  { name: 'Phường Bình An', lat: 10.7936, lon: 106.7214, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Bến Thuyền Ven Sông', fav: 0 },
  { name: 'Khu Đô Thị Thủ Thiêm', lat: 10.7735, lon: 106.7150, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Trung tâm Tài chính Mới', fav: 0 },
  { name: 'Phường Hiệp Phú', lat: 10.8520, lon: 106.7840, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Khu Công Nghệ Cao SHTP', fav: 0 },
  { name: 'Phường Linh Trung', lat: 10.8655, lon: 106.7760, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Làng Đại Học Quốc Gia', fav: 0 },
  { name: 'Phường Linh Chiểu', lat: 10.8519, lon: 106.7580, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Chợ Thủ Đức', fav: 0 },
  { name: 'Phường Trường Thọ', lat: 10.8350, lon: 106.7620, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Đô thị Trường Thọ', fav: 0 },
  { name: 'Phường Hiệp Bình Chánh', lat: 10.8285, lon: 106.7230, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'TTTM GigaMall', fav: 0 },
  { name: 'Phường Hiệp Bình Phước', lat: 10.8490, lon: 106.7150, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'KĐT Vạn Phúc City', fav: 0 },
  { name: 'Phường Long Thạnh Mỹ', lat: 10.8450, lon: 106.8400, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Vinhomes Grand Park', fav: 0 },
  { name: 'Phường Long Bình', lat: 10.8780, lon: 106.8370, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Bến xe Miền Đông mới', fav: 0 },
  { name: 'Phường Phước Long B', lat: 10.8250, lon: 106.7720, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Đỗ Xuân Hợp', fav: 0 },
  { name: 'Phường Thạnh Mỹ Lợi', lat: 10.7710, lon: 106.7590, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'UBND TP. Thủ Đức', fav: 0 },
  { name: 'Phường Cát Lái', lat: 10.7620, lon: 106.7820, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Cảng Cát Lái', fav: 0 },
  { name: 'Phường Tam Phú', lat: 10.8620, lon: 106.7450, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Bệnh viện Thủ Đức', fav: 0 },
  { name: 'Phường Tăng Nhơn Phú A', lat: 10.8480, lon: 106.7910, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Lê Văn Việt', fav: 0 },

  // --- Khu vực Nam Sài Gòn & Quận 7 cũ ---
  { name: 'Phường Tân Phong', lat: 10.7300, lon: 106.7050, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'KĐT Phú Mỹ Hưng / SC Vivo', fav: 0 },
  { name: 'Phường Tân Phú (Quận 7)', lat: 10.7280, lon: 106.7220, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Crescent Mall / BV FV', fav: 0 },
  { name: 'Phường Tân Thuận Đông', lat: 10.7650, lon: 106.7350, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'KCX Tân Thuận', fav: 0 },

  // --- Khu vực Bình Thạnh, Phú Nhuận, Gò Vấp, Tân Bình ---
  { name: 'Phường 22 (Bình Thạnh)', lat: 10.7930, lon: 106.7200, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Tòa tháp Landmark 81', fav: 0 },
  { name: 'Phường 19 (Bình Thạnh)', lat: 10.7910, lon: 106.7070, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Thị Nghè', fav: 0 },
  { name: 'Phường 25 (Bình Thạnh)', lat: 10.8030, lon: 106.7150, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Ngã Tư Hàng Xanh / D2', fav: 0 },
  { name: 'Phường 7 (Phú Nhuận)', lat: 10.7985, lon: 106.6890, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Phố Phan Xích Long', fav: 0 },
  { name: 'Phường 1 (Phú Nhuận)', lat: 10.7950, lon: 106.6780, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Cầu Kiệu', fav: 0 },
  { name: 'Phường 2 (Tân Bình)', lat: 10.8160, lon: 106.6630, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Sân bay Tân Sơn Nhất', fav: 0 },
  { name: 'Phường 12 (Tân Bình)', lat: 10.7980, lon: 106.6490, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Khu Bàu Cát', fav: 0 },
  { name: 'Phường 1 (Gò Vấp)', lat: 10.8200, lon: 106.6880, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Đại lộ Phạm Văn Đồng', fav: 0 },
  { name: 'Phường 10 (Gò Vấp)', lat: 10.8350, lon: 106.6710, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'KĐT Cityland / Ngã Sáu', fav: 0 },

  // --- Khu vực Quận 5, 6, 8, 10, Tân Phú, Bình Tân, Quận 12 ---
  { name: 'Phường Chợ Lớn', lat: 10.7540, lon: 106.6634, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Phố Người Hoa / Q5', fav: 0 },
  { name: 'Phường 11 (Quận 5)', lat: 10.7565, lon: 106.6600, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'BV Chợ Rẫy / ĐH Y Dược', fav: 0 },
  { name: 'Phường 1 (Quận 6)', lat: 10.7485, lon: 106.6515, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Chợ Bình Tây', fav: 0 },
  { name: 'Phường 4 (Quận 8)', lat: 10.7420, lon: 106.6780, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Cầu Chánh Hưng', fav: 0 },
  { name: 'Phường 12 (Quận 10)', lat: 10.7760, lon: 106.6690, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'TTTM Vạn Hạnh Mall', fav: 0 },
  { name: 'Phường Sơn Kỳ', lat: 10.8010, lon: 106.6180, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Aeon Mall Tân Phú', fav: 0 },
  { name: 'Phường An Lạc', lat: 10.7380, lon: 106.6090, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Bến xe Miền Tây / Bình Tân', fav: 0 },
  { name: 'Phường Bình Trị Đông', lat: 10.7440, lon: 106.6120, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Aeon Mall Bình Tân', fav: 0 },
  { name: 'Phường Trung Mỹ Tây', lat: 10.8540, lon: 106.6250, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'CV Phần Mềm Quang Trung', fav: 0 },

  // --- Khu vực Huyện ngoại thành TP.HCM ---
  { name: 'Thị trấn Cần Giờ', lat: 10.4114, lon: 106.9546, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Biển Cần Giờ', fav: 0 },
  { name: 'Thị trấn Củ Chi', lat: 10.9730, lon: 106.4950, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Địa đạo Củ Chi', fav: 0 },
  { name: 'Thị trấn Hóc Môn', lat: 10.8870, lon: 106.5920, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Hóc Môn', fav: 0 },
  { name: 'Thị trấn Nhà Bè', lat: 10.6950, lon: 106.7320, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Cảng Hiệp Phước', fav: 0 },
  { name: 'Thị trấn Tân Túc', lat: 10.6860, lon: 106.5750, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Bình Chánh', fav: 0 },

  // =========================================================================
  // 2. HÀ NỘI - CÁC PHƯỜNG & KHU ĐÔ THỊ TRỌNG ĐIỂM
  // =========================================================================
  { name: 'Hà Nội', lat: 21.0285, lon: 105.8542, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Thủ đô', fav: 0 },
  { name: 'Phường Tràng Tiền', lat: 21.0254, lon: 105.8564, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Nhà Hát Lớn / Hồ Gươm', fav: 0 },
  { name: 'Phường Hàng Bạc', lat: 21.0345, lon: 105.8530, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Phố Cổ / Tạ Hiện', fav: 0 },
  { name: 'Phường Hàng Đào', lat: 21.0340, lon: 105.8500, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Chợ Đồng Xuân', fav: 0 },
  { name: 'Phường Quán Thánh', lat: 21.0425, lon: 105.8390, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Hồ Trúc Bạch / Đền Quán Thánh', fav: 0 },
  { name: 'Phường Điện Biên', lat: 21.0335, lon: 105.8360, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Quảng trường Ba Đình / Lăng Bác', fav: 0 },
  { name: 'Phường Liễu Giai', lat: 21.0330, lon: 105.8150, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Tòa Lotte Center Hà Nội', fav: 0 },
  { name: 'Phường Quảng An', lat: 21.0640, lon: 105.8260, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Bán đảo Tây Hồ / Phủ Tây Hồ', fav: 0 },
  { name: 'Phường Yên Phụ', lat: 21.0530, lon: 105.8380, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Đê Yên Phụ / Khách sạn Thắng Lợi', fav: 0 },
  { name: 'Phường Dịch Vọng Hậu', lat: 21.0360, lon: 105.7870, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Phố Duy Tân / Cầu Giấy', fav: 0 },
  { name: 'Phường Nghĩa Tân', lat: 21.0460, lon: 105.7950, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Công viên Nghĩa Đô', fav: 0 },
  { name: 'Phường Bách Khoa', lat: 21.0040, lon: 105.8450, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Cụm ĐH Bách Khoa', fav: 0 },
  { name: 'Phường Ô Chợ Dừa', lat: 21.0180, lon: 105.8240, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Hồ Hoàng Cầu / Đống Đa', fav: 0 },
  { name: 'Phường Mỹ Đình 1', lat: 21.0200, lon: 105.7640, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Sân Vận Động Mỹ Đình', fav: 0 },
  { name: 'Phường Mễ Trì', lat: 21.0150, lon: 105.7830, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Keangnam Landmark 72', fav: 0 },
  { name: 'Phường Phú La', lat: 20.9610, lon: 105.7670, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Metro Cát Linh - Hà Đông', fav: 0 },
  { name: 'Phường Bồ Đề', lat: 21.0320, lon: 105.8720, admin1: 'Thủ đô Hà Nội', region: 'Hà Nội', label: 'Cầu Chương Dương / Long Biên', fav: 0 },

  // =========================================================================
  // 3. ĐÀ NẴNG - CÁC PHƯỜNG TRỌNG ĐIỂM
  // =========================================================================
  { name: 'Đà Nẵng', lat: 16.0544, lon: 108.2022, admin1: 'TP. Đà Nẵng', region: 'Miền Trung', label: 'Thành phố Đáng Sống', fav: 0 },
  { name: 'Phường Thạch Thang', lat: 16.0740, lon: 108.2210, admin1: 'TP. Đà Nẵng', region: 'Miền Trung', label: 'Trung tâm Hành chính / Cầu Sông Hàn', fav: 0 },
  { name: 'Phường Hải Châu 1', lat: 16.0650, lon: 108.2230, admin1: 'TP. Đà Nẵng', region: 'Miền Trung', label: 'Cầu Rồng / Bạch Đằng', fav: 0 },
  { name: 'Phường An Hải Bắc', lat: 16.0680, lon: 108.2390, admin1: 'TP. Đà Nẵng', region: 'Miền Trung', label: 'Bãi biển Mỹ Khê', fav: 0 },
  { name: 'Phường Phước Mỹ', lat: 16.0620, lon: 108.2460, admin1: 'TP. Đà Nẵng', region: 'Miền Trung', label: 'Công viên Biển Đông', fav: 0 },
  { name: 'Phường Thọ Quang', lat: 16.1000, lon: 108.2700, admin1: 'TP. Đà Nẵng', region: 'Miền Trung', label: 'Bán đảo Sơn Trà / Linh Ứng', fav: 0 },
  { name: 'Phường Mỹ An', lat: 16.0460, lon: 108.2430, admin1: 'TP. Đà Nẵng', region: 'Miền Trung', label: 'Bãi biển Bắc Mỹ An', fav: 0 },
  { name: 'Phường Khuê Mỹ', lat: 16.0150, lon: 108.2560, admin1: 'TP. Đà Nẵng', region: 'Miền Trung', label: 'Danh thắng Ngũ Hành Sơn', fav: 0 },

  // =========================================================================
  // 4. CÁC TỈNH THÀNH LỚN & ĐIỂM DU LỊCH (CÓ PHƯỜNG TRỌNG ĐIỂM)
  // =========================================================================
  // --- Hải Phòng ---
  { name: 'Hải Phòng', lat: 20.8449, lon: 106.6881, admin1: 'TP. Hải Phòng', region: 'Miền Bắc', label: 'Thành phố Cảng', fav: 0 },
  { name: 'Phường Hoàng Văn Thụ', lat: 20.8600, lon: 106.6800, admin1: 'TP. Hải Phòng', region: 'Miền Bắc', label: 'Nhà hát lớn Hải Phòng', fav: 0 },
  { name: 'Phường Minh Khai (Hải Phòng)', lat: 20.8630, lon: 106.6870, admin1: 'TP. Hải Phòng', region: 'Miền Bắc', label: 'Cảng Hải Phòng', fav: 0 },
  { name: 'Phường Đằng Lâm', lat: 20.8280, lon: 106.7170, admin1: 'TP. Hải Phòng', region: 'Miền Bắc', label: 'Sân bay Cát Bi', fav: 0 },
  { name: 'Phường Vạn Hương', lat: 20.7020, lon: 106.7900, admin1: 'TP. Hải Phòng', region: 'Miền Bắc', label: 'Bãi biển Đồ Sơn', fav: 0 },
  { name: 'Thị trấn Cát Bà', lat: 20.7250, lon: 107.0500, admin1: 'TP. Hải Phòng', region: 'Miền Bắc', label: 'Vịnh Lan Hạ Cát Bà', fav: 0 },

  // --- Sa Pa & Lào Cai ---
  { name: 'Sa Pa', lat: 22.3364, lon: 103.8438, admin1: 'Lào Cai', region: 'Miền Bắc', label: 'Xứ sở Sương Mù', fav: 0 },
  { name: 'Phường Sa Pa', lat: 22.3364, lon: 103.8438, admin1: 'Lào Cai', region: 'Miền Bắc', label: 'Nhà thờ Đá Sa Pa', fav: 0 },
  { name: 'Phường Phan Si Păng', lat: 22.3270, lon: 103.8290, admin1: 'Lào Cai', region: 'Miền Bắc', label: 'Cáp treo Fansipan', fav: 0 },
  { name: 'Phường Cầu Mây', lat: 22.3150, lon: 103.8490, admin1: 'Lào Cai', region: 'Miền Bắc', label: 'Bản Cát Cát / Mường Hoa', fav: 0 },

  // --- Thừa Thiên Huế ---
  { name: 'Thừa Thiên Huế', lat: 16.4637, lon: 107.5909, admin1: 'Thừa Thiên Huế', region: 'Miền Trung', label: 'Cố đô Huế', fav: 0 },
  { name: 'Phường Phú Hội', lat: 16.4670, lon: 107.5950, admin1: 'Thừa Thiên Huế', region: 'Miền Trung', label: 'Phố Tây Huế / Sông Hương', fav: 0 },
  { name: 'Phường Thuận Hòa', lat: 16.4720, lon: 107.5780, admin1: 'Thừa Thiên Huế', region: 'Miền Trung', label: 'Đại Nội Huế', fav: 0 },
  { name: 'Phường Vĩnh Ninh', lat: 16.4580, lon: 107.5850, admin1: 'Thừa Thiên Huế', region: 'Miền Trung', label: 'Ga Huế', fav: 0 },
  { name: 'Phường Thủy Xuân', lat: 16.4350, lon: 107.5680, admin1: 'Thừa Thiên Huế', region: 'Miền Trung', label: 'Làng hương Thủy Xuân', fav: 0 },

  // --- Nha Trang (Khánh Hòa) ---
  { name: 'Nha Trang', lat: 12.2388, lon: 109.1967, admin1: 'Khánh Hòa', region: 'Miền Trung', label: 'Vịnh Biển Đẹp', fav: 0 },
  { name: 'Phường Lộc Thọ', lat: 12.2420, lon: 109.1960, admin1: 'Khánh Hòa', region: 'Miền Trung', label: 'Đường biển Trần Phú / Tháp Trầm Hương', fav: 0 },
  { name: 'Phường Vĩnh Phước', lat: 12.2680, lon: 109.1980, admin1: 'Khánh Hòa', region: 'Miền Trung', label: 'Tháp Bà Ponagar / Hòn Chồng', fav: 0 },
  { name: 'Phường Vĩnh Nguyên', lat: 12.2070, lon: 109.2150, admin1: 'Khánh Hòa', region: 'Miền Trung', label: 'Cảng Vinpearl Nha Trang', fav: 0 },

  // --- Đà Lạt (Lâm Đồng) ---
  { name: 'Đà Lạt', lat: 11.9404, lon: 108.4583, admin1: 'Lâm Đồng', region: 'Miền Trung', label: 'Thành phố Ngàn Hoa', fav: 0 },
  { name: 'Phường 1 (Đà Lạt)', lat: 11.9404, lon: 108.4377, admin1: 'Lâm Đồng', region: 'Miền Trung', label: 'Hồ Xuân Hương / Chợ Đêm', fav: 0 },
  { name: 'Phường 10 (Đà Lạt)', lat: 11.9360, lon: 108.4520, admin1: 'Lâm Đồng', region: 'Miền Trung', label: 'Ga Đà Lạt / Quảng trường Lâm Viên', fav: 0 },
  { name: 'Phường 7 (Đà Lạt)', lat: 11.9820, lon: 108.4350, admin1: 'Lâm Đồng', region: 'Miền Trung', label: 'Langbiang / Thung Lũng Tình Yêu', fav: 0 },
  { name: 'Phường 3 (Đà Lạt)', lat: 11.9210, lon: 108.4390, admin1: 'Lâm Đồng', region: 'Miền Trung', label: 'Cáp treo Đồi Robin', fav: 0 },

  // --- Cần Thơ ---
  { name: 'Cần Thơ', lat: 10.0452, lon: 105.7469, admin1: 'TP. Cần Thơ', region: 'Miền Nam', label: 'Tây Đô', fav: 0 },
  { name: 'Phường Tân An (Cần Thơ)', lat: 10.0330, lon: 105.7870, admin1: 'TP. Cần Thơ', region: 'Miền Nam', label: 'Bến Ninh Kiều', fav: 0 },
  { name: 'Phường Cái Khế', lat: 10.0500, lon: 105.7860, admin1: 'TP. Cần Thơ', region: 'Miền Nam', label: 'Cồn Cái Khế', fav: 0 },
  { name: 'Phường Trà Nóc', lat: 10.0820, lon: 105.7320, admin1: 'TP. Cần Thơ', region: 'Miền Nam', label: 'Sân bay Cần Thơ', fav: 0 },
  { name: 'Phường Lê Bình', lat: 10.0050, lon: 105.7530, admin1: 'TP. Cần Thơ', region: 'Miền Nam', label: 'Chợ nổi Cái Răng', fav: 0 },

  // --- Bà Rịa - Vũng Tàu ---
  { name: 'Bà Rịa - Vũng Tàu', lat: 10.3460, lon: 107.0843, admin1: 'Bà Rịa - Vũng Tàu', region: 'Miền Nam', label: 'TP. Vũng Tàu', fav: 0 },
  { name: 'Phường 1 (Vũng Tàu)', lat: 10.3460, lon: 107.0730, admin1: 'Bà Rịa - Vũng Tàu', region: 'Miền Nam', label: 'Bãi Trước Vũng Tàu', fav: 0 },
  { name: 'Phường 2 (Vũng Tàu)', lat: 10.3340, lon: 107.0860, admin1: 'Bà Rịa - Vũng Tàu', region: 'Miền Nam', label: 'Bãi Sau / Tượng Chúa', fav: 0 },
  { name: 'Phường Thắng Tam', lat: 10.3420, lon: 107.0910, admin1: 'Bà Rịa - Vũng Tàu', region: 'Miền Nam', label: 'Quảng trường Cột Cờ', fav: 0 },
  { name: 'Thị trấn Côn Đảo', lat: 8.6830, lon: 106.6070, admin1: 'Bà Rịa - Vũng Tàu', region: 'Miền Nam', label: 'Đảo Côn Đảo', fav: 0 },

  // --- Phú Quốc (Kiên Giang) ---
  { name: 'Phú Quốc', lat: 10.2289, lon: 103.9572, admin1: 'Kiên Giang', region: 'Miền Nam', label: 'Đảo Ngọc', fav: 0 },
  { name: 'Phường Dương Đông', lat: 10.2180, lon: 103.9610, admin1: 'Kiên Giang', region: 'Miền Nam', label: 'Chợ Đêm Phú Quốc / Dinh Cậu', fav: 0 },
  { name: 'Phường An Thới', lat: 10.0280, lon: 104.0150, admin1: 'Kiên Giang', region: 'Miền Nam', label: 'Cáp treo Hòn Thơm', fav: 0 },
  { name: 'Xã Gành Dầu', lat: 10.3680, lon: 103.8640, admin1: 'Kiên Giang', region: 'Miền Nam', label: 'Grand World / Safari', fav: 0 },

  // --- Hội An & Quy Nhơn & Phan Thiết ---
  { name: 'Hội An', lat: 15.8801, lon: 108.3380, admin1: 'Quảng Nam', region: 'Miền Trung', label: 'Phố Cổ Hội An', fav: 0 },
  { name: 'Phường Minh An (Hội An)', lat: 15.8770, lon: 108.3280, admin1: 'Quảng Nam', region: 'Miền Trung', label: 'Chùa Cầu Hội An', fav: 0 },
  { name: 'Quy Nhơn', lat: 13.7820, lon: 109.2197, admin1: 'Bình Định', region: 'Miền Trung', label: 'Kỳ Co - Eo Gió', fav: 0 },
  { name: 'Phan Thiết', lat: 10.9289, lon: 108.1021, admin1: 'Bình Thuận', region: 'Miền Trung', label: 'Mũi Né', fav: 0 },
  { name: 'Phường Mũi Né', lat: 10.9330, lon: 108.2830, admin1: 'Bình Thuận', region: 'Miền Trung', label: 'Đồi Cát Bay Mũi Né', fav: 0 },

  // =========================================================================
  // 5. TOÀN BỘ CÁC TỈNH THÀNH CÒN LẠI CỦA VIỆT NAM (ĐỦ 63 TỈNH THÀNH)
  // =========================================================================
  // --- Miền Bắc ---
  { name: 'Quảng Ninh', lat: 20.9505, lon: 107.0734, admin1: 'Quảng Ninh', region: 'Miền Bắc', label: 'Vịnh Hạ Long', fav: 0 },
  { name: 'Lào Cai', lat: 22.4856, lon: 103.9707, admin1: 'Lào Cai', region: 'Miền Bắc', label: 'Cửa khẩu', fav: 0 },
  { name: 'Ninh Bình', lat: 20.2506, lon: 105.9745, admin1: 'Ninh Bình', region: 'Miền Bắc', label: 'Tràng An', fav: 0 },
  { name: 'Bắc Ninh', lat: 21.1861, lon: 106.0763, admin1: 'Bắc Ninh', region: 'Miền Bắc', label: 'Xứ Kinh Bắc', fav: 0 },
  { name: 'Hải Dương', lat: 20.9375, lon: 106.3146, admin1: 'Hải Dương', region: 'Miền Bắc', label: 'Đông Bắc Bộ', fav: 0 },
  { name: 'Hưng Yên', lat: 20.6464, lon: 106.0511, admin1: 'Hưng Yên', region: 'Miền Bắc', label: 'Phố Hiến', fav: 0 },
  { name: 'Hà Nam', lat: 20.5453, lon: 105.9122, admin1: 'Hà Nam', region: 'Miền Bắc', label: 'Phủ Lý', fav: 0 },
  { name: 'Nam Định', lat: 20.4344, lon: 106.1685, admin1: 'Nam Định', region: 'Miền Bắc', label: 'Đồng bằng Sông Hồng', fav: 0 },
  { name: 'Thái Bình', lat: 20.4463, lon: 106.3366, admin1: 'Thái Bình', region: 'Miền Bắc', label: 'Quê lúa', fav: 0 },
  { name: 'Vĩnh Phúc', lat: 21.3089, lon: 105.6049, admin1: 'Vĩnh Phúc', region: 'Miền Bắc', label: 'Tam Đảo', fav: 0 },
  { name: 'Hà Giang', lat: 22.8233, lon: 104.9839, admin1: 'Hà Giang', region: 'Miền Bắc', label: 'Cao nguyên đá Đồng Văn', fav: 0 },
  { name: 'Cao Bằng', lat: 22.6667, lon: 106.2500, admin1: 'Cao Bằng', region: 'Miền Bắc', label: 'Thác Bản Giốc', fav: 0 },
  { name: 'Bắc Kạn', lat: 22.1470, lon: 105.8348, admin1: 'Bắc Kạn', region: 'Miền Bắc', label: 'Hồ Ba Bể', fav: 0 },
  { name: 'Lạng Sơn', lat: 21.8537, lon: 106.7615, admin1: 'Lạng Sơn', region: 'Miền Bắc', label: 'Ải Chi Lăng', fav: 0 },
  { name: 'Tuyên Quang', lat: 21.8236, lon: 105.2144, admin1: 'Tuyên Quang', region: 'Miền Bắc', label: 'Tân Trào', fav: 0 },
  { name: 'Thái Nguyên', lat: 21.5942, lon: 105.8482, admin1: 'Thái Nguyên', region: 'Miền Bắc', label: 'Thủ phủ Chè', fav: 0 },
  { name: 'Phú Thọ', lat: 21.3228, lon: 105.4019, admin1: 'Phú Thọ', region: 'Miền Bắc', label: 'Đất Tổ Hùng Vương', fav: 0 },
  { name: 'Bắc Giang', lat: 21.2731, lon: 106.1946, admin1: 'Bắc Giang', region: 'Miền Bắc', label: 'Lục Ngạn', fav: 0 },
  { name: 'Yên Bái', lat: 21.7168, lon: 104.9113, admin1: 'Yên Bái', region: 'Miền Bắc', label: 'Mù Cang Chải', fav: 0 },
  { name: 'Điện Biên', lat: 21.3869, lon: 103.0231, admin1: 'Điện Biên', region: 'Miền Bắc', label: 'Điện Biên Phủ', fav: 0 },
  { name: 'Hòa Bình', lat: 20.8172, lon: 105.3376, admin1: 'Hòa Bình', region: 'Miền Bắc', label: 'Thung lũng Mai Châu', fav: 0 },
  { name: 'Lai Châu', lat: 22.3964, lon: 103.4754, admin1: 'Lai Châu', region: 'Miền Bắc', label: 'Tây Bắc', fav: 0 },
  { name: 'Sơn La', lat: 21.3283, lon: 103.9148, admin1: 'Sơn La', region: 'Miền Bắc', label: 'Mộc Châu', fav: 0 },

  // --- Miền Trung & Tây Nguyên ---
  { name: 'Thanh Hóa', lat: 19.8067, lon: 105.7852, admin1: 'Thanh Hóa', region: 'Miền Trung', label: 'Sầm Sơn', fav: 0 },
  { name: 'Nghệ An', lat: 18.6734, lon: 105.6813, admin1: 'Nghệ An', region: 'Miền Trung', label: 'TP. Vinh', fav: 0 },
  { name: 'Hà Tĩnh', lat: 18.3430, lon: 105.9059, admin1: 'Hà Tĩnh', region: 'Miền Trung', label: 'Bắc Trung Bộ', fav: 0 },
  { name: 'Quảng Bình', lat: 17.4690, lon: 106.6223, admin1: 'Quảng Bình', region: 'Miền Trung', label: 'Phong Nha Kẻ Bàng', fav: 0 },
  { name: 'Quảng Trị', lat: 16.8163, lon: 107.1048, admin1: 'Quảng Trị', region: 'Miền Trung', label: 'Đông Hà', fav: 0 },
  { name: 'Quảng Ngãi', lat: 15.1205, lon: 108.7923, admin1: 'Quảng Ngãi', region: 'Miền Trung', label: 'Đảo Lý Sơn', fav: 0 },
  { name: 'Phú Yên', lat: 13.0882, lon: 109.3075, admin1: 'Phú Yên', region: 'Miền Trung', label: 'Gành Đá Đĩa', fav: 0 },
  { name: 'Ninh Thuận', lat: 11.5643, lon: 108.9897, admin1: 'Ninh Thuận', region: 'Miền Trung', label: 'Vịnh Vĩnh Hy', fav: 0 },
  { name: 'Kon Tum', lat: 14.3497, lon: 108.0005, admin1: 'Kon Tum', region: 'Miền Trung', label: 'Măng Đen', fav: 0 },
  { name: 'Gia Lai', lat: 13.9833, lon: 108.0000, admin1: 'Gia Lai', region: 'Miền Trung', label: 'Biển Hồ Pleiku', fav: 0 },
  { name: 'Đắk Lắk', lat: 12.6667, lon: 108.0500, admin1: 'Đắk Lắk', region: 'Miền Trung', label: 'Buôn Ma Thuột', fav: 0 },
  { name: 'Đắk Nông', lat: 12.0039, lon: 107.6908, admin1: 'Đắk Nông', region: 'Miền Trung', label: 'Tà Đùng', fav: 0 },

  // --- Miền Nam ---
  { name: 'Bình Dương', lat: 10.9805, lon: 106.6519, admin1: 'Bình Dương', region: 'Miền Nam', label: 'Thủ Dầu Một', fav: 0 },
  { name: 'Đồng Nai', lat: 10.9460, lon: 106.8242, admin1: 'Đồng Nai', region: 'Miền Nam', label: 'TP. Biên Hòa', fav: 0 },
  { name: 'Kiên Giang', lat: 10.0125, lon: 105.0809, admin1: 'Kiên Giang', region: 'Miền Nam', label: 'Rạch Giá', fav: 0 },
  { name: 'Tây Ninh', lat: 11.3101, lon: 106.0983, admin1: 'Tây Ninh', region: 'Miền Nam', label: 'Núi Bà Đen', fav: 0 },
  { name: 'Bình Phước', lat: 11.5333, lon: 106.8833, admin1: 'Bình Phước', region: 'Miền Nam', label: 'Đồng Xoài', fav: 0 },
  { name: 'Long An', lat: 10.5360, lon: 106.4137, admin1: 'Long An', region: 'Miền Nam', label: 'TP. Tân An', fav: 0 },
  { name: 'Tiền Giang', lat: 10.3600, lon: 106.3600, admin1: 'Tiền Giang', region: 'Miền Nam', label: 'TP. Mỹ Tho', fav: 0 },
  { name: 'Bến Tre', lat: 10.2415, lon: 106.3759, admin1: 'Bến Tre', region: 'Miền Nam', label: 'Xứ Dừa', fav: 0 },
  { name: 'Trà Vinh', lat: 9.9347, lon: 106.3455, admin1: 'Trà Vinh', region: 'Miền Nam', label: 'Thành phố Cổ', fav: 0 },
  { name: 'Vĩnh Long', lat: 10.2537, lon: 105.9722, admin1: 'Vĩnh Long', region: 'Miền Nam', label: 'Cù Lao An Bình', fav: 0 },
  { name: 'Đồng Tháp', lat: 10.4593, lon: 105.6329, admin1: 'Đồng Tháp', region: 'Miền Nam', label: 'Cao Lãnh / Sa Đéc', fav: 0 },
  { name: 'An Giang', lat: 10.3833, lon: 105.4167, admin1: 'An Giang', region: 'Miền Nam', label: 'Châu Đốc / Long Xuyên', fav: 0 },
  { name: 'Hậu Giang', lat: 9.7844, lon: 105.4701, admin1: 'Hậu Giang', region: 'Miền Nam', label: 'TP. Vị Thanh', fav: 0 },
  { name: 'Sóc Trăng', lat: 9.6033, lon: 105.9800, admin1: 'Sóc Trăng', region: 'Miền Nam', label: 'Chùa Dơi', fav: 0 },
  { name: 'Bạc Liêu', lat: 9.2941, lon: 105.7278, admin1: 'Bạc Liêu', region: 'Miền Nam', label: 'Điện Gió Bạc Liêu', fav: 0 },
  { name: 'Cà Mau', lat: 9.1769, lon: 105.1500, admin1: 'Cà Mau', region: 'Miền Nam', label: 'Mũi Cà Mau', fav: 0 }
];

export function ensureSeedLocations() {
  const insertStmt = db.prepare(`
    INSERT INTO locations (name, latitude, longitude, country, admin1, region, timezone, custom_label, notes, is_favorite)
    VALUES (?, ?, ?, 'Vietnam', ?, ?, 'Asia/Ho_Chi_Minh', ?, '', ?)
  `);

  const checkStmt = db.prepare('SELECT id FROM locations WHERE name = ? AND admin1 = ? LIMIT 1');

  for (const loc of VIETNAM_PROVINCES_AND_HUBS) {
    const exists = checkStmt.get(loc.name, loc.admin1);
    if (!exists) {
      insertStmt.run(loc.name, loc.lat, loc.lon, loc.admin1, loc.region, loc.label, loc.fav);
    }
  }

  // Ensure Phường Bến Nghé (TP.HCM) is the top active favorite
  db.prepare(`UPDATE locations SET is_favorite = 1 WHERE name = 'Phường Bến Nghé'`).run();
}

ensureSeedLocations();

