import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const dbPath = path.join(dataDir, 'weather.db');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency and performance
db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);

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
// TOÀN BỘ 63 TỈNH THÀNH VIỆT NAM & PHƯỜNG TRỌNG ĐIỂM TP. HỒ CHÍ MINH
// =========================================================================
export const VIETNAM_PROVINCES_AND_HUBS = [
  // --- TP. HỒ CHÍ MINH (Các phường & trung tâm hành chính mới) ---
  { name: 'Phường Bến Nghé', lat: 10.7769, lon: 106.7009, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Trung tâm', fav: 1 },
  { name: 'Phường Bến Thành', lat: 10.7719, lon: 106.6983, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Chợ Bến Thành', fav: 0 },
  { name: 'Phường Thảo Điền', lat: 10.8037, lon: 106.7324, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Thảo Điền', fav: 0 },
  { name: 'Phường An Phú', lat: 10.7963, lon: 106.7511, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'An Phú', fav: 0 },
  { name: 'Phường Hiệp Phú', lat: 10.8520, lon: 106.7840, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Khu Công Nghệ Cao', fav: 0 },
  { name: 'Khu Đô Thị Thủ Thiêm', lat: 10.7735, lon: 106.7150, admin1: 'TP. Thủ Đức', region: 'TP.HCM', label: 'Thủ Thiêm', fav: 0 },
  { name: 'Phường Tân Định', lat: 10.7906, lon: 106.6914, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Nhà thờ Tân Định', fav: 0 },
  { name: 'Phường Chợ Lớn', lat: 10.7540, lon: 106.6634, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Phố Người Hoa', fav: 0 },
  { name: 'Phường Phú Mỹ Hưng', lat: 10.7340, lon: 106.7218, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Đô thị Nam Sài Gòn', fav: 0 },
  { name: 'Thị trấn Cần Giờ', lat: 10.4114, lon: 106.9546, admin1: 'TP. Hồ Chí Minh', region: 'TP.HCM', label: 'Biển Cần Giờ', fav: 0 },

  // --- MIỀN BẮC (25 Tỉnh / Thành phố) ---
  { name: 'Hà Nội', lat: 21.0285, lon: 105.8542, admin1: 'Thủ đô Hà Nội', region: 'Miền Bắc', label: 'Thủ đô', fav: 0 },
  { name: 'Hải Phòng', lat: 20.8449, lon: 106.6881, admin1: 'TP. Hải Phòng', region: 'Miền Bắc', label: 'Thành phố Cảng', fav: 0 },
  { name: 'Quảng Ninh', lat: 20.9505, lon: 107.0734, admin1: 'Quảng Ninh', region: 'Miền Bắc', label: 'Vịnh Hạ Long', fav: 0 },
  { name: 'Sa Pa', lat: 22.3364, lon: 103.8438, admin1: 'Lào Cai', region: 'Miền Bắc', label: 'Xứ sở Sương Mù', fav: 0 },
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

  // --- MIỀN TRUNG & TÂY NGUYÊN (19 Tỉnh / Thành phố) ---
  { name: 'Đà Nẵng', lat: 16.0544, lon: 108.2022, admin1: 'TP. Đà Nẵng', region: 'Miền Trung', label: 'Thành phố Đáng Sống', fav: 0 },
  { name: 'Thừa Thiên Huế', lat: 16.4637, lon: 107.5909, admin1: 'Thừa Thiên Huế', region: 'Miền Trung', label: 'Cố đô Huế', fav: 0 },
  { name: 'Đà Lạt', lat: 11.9404, lon: 108.4583, admin1: 'Lâm Đồng', region: 'Miền Trung', label: 'Thành phố Ngàn Hoa', fav: 0 },
  { name: 'Nha Trang', lat: 12.2388, lon: 109.1967, admin1: 'Khánh Hòa', region: 'Miền Trung', label: 'Vịnh Biển Đẹp', fav: 0 },
  { name: 'Hội An', lat: 15.8801, lon: 108.3380, admin1: 'Quảng Nam', region: 'Miền Trung', label: 'Phố Cổ', fav: 0 },
  { name: 'Quy Nhơn', lat: 13.7820, lon: 109.2197, admin1: 'Bình Định', region: 'Miền Trung', label: 'Kỳ Co - Eo Gió', fav: 0 },
  { name: 'Phan Thiết', lat: 10.9289, lon: 108.1021, admin1: 'Bình Thuận', region: 'Miền Trung', label: 'Mũi Né', fav: 0 },
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

  // --- MIỀN NAM (Đông Nam Bộ & Tây Nam Bộ - 19 Tỉnh / Thành phố) ---
  { name: 'Cần Thơ', lat: 10.0452, lon: 105.7469, admin1: 'TP. Cần Thơ', region: 'Miền Nam', label: 'Tây Đô', fav: 0 },
  { name: 'Bà Rịa - Vũng Tàu', lat: 10.3460, lon: 107.0843, admin1: 'Bà Rịa - Vũng Tàu', region: 'Miền Nam', label: 'TP. Vũng Tàu', fav: 0 },
  { name: 'Bình Dương', lat: 10.9805, lon: 106.6519, admin1: 'Bình Dương', region: 'Miền Nam', label: 'Thủ Dầu Một', fav: 0 },
  { name: 'Đồng Nai', lat: 10.9460, lon: 106.8242, admin1: 'Đồng Nai', region: 'Miền Nam', label: 'TP. Biên Hòa', fav: 0 },
  { name: 'Phú Quốc', lat: 10.2289, lon: 103.9572, admin1: 'Kiên Giang', region: 'Miền Nam', label: 'Đảo Ngọc', fav: 0 },
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

  const checkStmt = db.prepare('SELECT id FROM locations WHERE name = ? LIMIT 1');

  for (const loc of VIETNAM_PROVINCES_AND_HUBS) {
    const exists = checkStmt.get(loc.name);
    if (!exists) {
      insertStmt.run(loc.name, loc.lat, loc.lon, loc.admin1, loc.region, loc.label, loc.fav);
    }
  }

  // Ensure Phường Bến Nghé (TP.HCM) is the top active favorite
  db.prepare(`UPDATE locations SET is_favorite = 1 WHERE name = 'Phường Bến Nghé'`).run();
}

ensureSeedLocations();
