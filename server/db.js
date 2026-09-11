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
// BẢN ĐỒ HÀNH CHÍNH MỚI NHẤT VIỆT NAM (34 TỈNH/THÀNH PHỐ & PHƯỜNG CHUẨN XÁC)
// =========================================================================
export const VIETNAM_PROVINCES_AND_HUBS = [
  // =========================================================================
  // 1. 6 THÀNH PHỐ TRỰC THUỘC TRUNG ƯƠNG (TRUNG TÂM ĐÔ THỊ & HÀNH CHÍNH)
  // =========================================================================
  { name: 'Thành phố Hồ Chí Minh', lat: 10.8231, lon: 106.6297, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Đô thị đặc biệt phía Nam', fav: 0 },
  { name: 'Thành phố Hà Nội', lat: 21.0285, lon: 105.8542, admin1: 'Thành phố Hà Nội', region: 'Hà Nội', label: 'Thủ đô nước CHXHCN Việt Nam', fav: 0 },
  { name: 'Thành phố Hải Phòng', lat: 20.8449, lon: 106.6881, admin1: 'Thành phố Hải Phòng', region: 'Miền Bắc', label: 'Thành phố Cảng Đông Bắc', fav: 0 },
  { name: 'Thành phố Đà Nẵng', lat: 16.0544, lon: 108.2022, admin1: 'Thành phố Đà Nẵng', region: 'Miền Trung', label: 'Đô thị hạt nhân Miền Trung', fav: 0 },
  { name: 'Thành phố Huế', lat: 16.4637, lon: 107.5909, admin1: 'Thành phố Huế', region: 'Miền Trung', label: 'Cố đô di sản văn hóa', fav: 0 },
  { name: 'Thành phố Cần Thơ', lat: 10.0452, lon: 105.7469, admin1: 'Thành phố Cần Thơ', region: 'Miền Nam', label: 'Trung tâm Tây Nam Bộ', fav: 0 },

  // =========================================================================
  // 2. TP. HỒ CHÍ MINH - CÁC PHƯỜNG CHUẨN XÁC THEO BẢN ĐỒ MỚI NHẤT
  // =========================================================================
  // --- Khu vực Quận 12 (Toàn bộ 11 Phường chuẩn xác) ---
  { name: 'Phường Thới An', lat: 10.8656, lon: 106.6625, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'UBND Quận 12 / Lê Thị Riêng', fav: 1 },
  { name: 'Phường Hiệp Thành', lat: 10.8750, lon: 106.6430, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Nguyễn Ảnh Thủ / Chợ Hiệp Thành', fav: 0 },
  { name: 'Phường Tân Chánh Hiệp', lat: 10.8610, lon: 106.6270, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Tô Ký / ĐH Giao Thông Vận Tải', fav: 0 },
  { name: 'Phường Thạnh Xuân', lat: 10.8760, lon: 106.6820, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Hà Huy Giáp / Thạnh Xuân', fav: 0 },
  { name: 'Phường Thạnh Lộc', lat: 10.8710, lon: 106.7020, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Ngã Tư Ga / Cầu Phú Long', fav: 0 },
  { name: 'Phường An Phú Đông', lat: 10.8520, lon: 106.6980, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Tu Viện Khánh An', fav: 0 },
  { name: 'Phường Tân Thới Hiệp', lat: 10.8580, lon: 106.6470, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Bệnh Viện Quận 12 / Metro', fav: 0 },
  { name: 'Phường Đông Hưng Thuận', lat: 10.8400, lon: 106.6260, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Nguyễn Văn Quá / Chợ Cầu', fav: 0 },
  { name: 'Phường Tân Hưng Thuận', lat: 10.8350, lon: 106.6210, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Song Hành / An Sương', fav: 0 },
  { name: 'Phường Tân Thới Nhất', lat: 10.8310, lon: 106.6110, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Bà Điểm / Phan Văn Hớn', fav: 0 },
  { name: 'Phường Trung Mỹ Tây', lat: 10.8540, lon: 106.6250, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Công Viên Phần Mềm Quang Trung', fav: 0 },

  // --- Khu vực Trung tâm Sài Gòn ---
  { name: 'Phường Bến Thành', lat: 10.7725, lon: 106.6980, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Chợ Bến Thành / Phố đi bộ', fav: 0 },
  { name: 'Phường Đa Kao', lat: 10.7917, lon: 106.6975, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Đa Kao / Hoàng Sa', fav: 0 },
  { name: 'Phường Tân Định', lat: 10.7906, lon: 106.6914, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Nhà thờ Tân Định', fav: 0 },
  { name: 'Phường Võ Thị Sáu', lat: 10.7850, lon: 106.6931, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Hồ Con Rùa / Quận 3', fav: 0 },
  { name: 'Phường 22 (Bình Thạnh)', lat: 10.7930, lon: 106.7200, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Tòa tháp Landmark 81', fav: 0 },
  { name: 'Phường Tân Phong', lat: 10.7300, lon: 106.7050, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'KĐT Phú Mỹ Hưng / SC Vivo', fav: 0 },

  // --- Khu vực Đô thị Vệ tinh & Sáp nhập ---
  { name: 'Phường Thảo Điền', lat: 10.8037, lon: 106.7324, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Bán đảo Thảo Điền / TP. Thủ Đức', fav: 0 },
  { name: 'Phường An Phú', lat: 10.7963, lon: 106.7511, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Masteri / Mega Market', fav: 0 },
  { name: 'Phường Thủ Thiêm', lat: 10.7735, lon: 106.7150, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Trung tâm Tài chính Mới', fav: 0 },
  { name: 'Phường Hiệp Bình Chánh', lat: 10.8285, lon: 106.7230, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'TTTM GigaMall Phạm Văn Đồng', fav: 0 },
  { name: 'Phường Thủ Dầu Một', lat: 10.9805, lon: 106.6525, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Thủ Dầu Một / Bình Dương', fav: 0 },
  { name: 'Phường Bến Cát', lat: 11.1630, lon: 106.6150, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Khu Công Nghiệp Mỹ Phước', fav: 0 },
  { name: 'Phường Vũng Tàu', lat: 10.3559, lon: 107.0843, admin1: 'Thành phố Hồ Chí Minh', region: 'TP.HCM', label: 'Bãi Sau / Bãi Trước Vũng Tàu', fav: 0 },

  // =========================================================================
  // 3. THỦ ĐÔ HÀ NỘI - CÁC PHƯỜNG CHUẨN XÁC THEO BẢN ĐỒ MỚI NHẤT
  // =========================================================================
  { name: 'Phường Tràng Tiền', lat: 21.0255, lon: 105.8565, admin1: 'Thành phố Hà Nội', region: 'Hà Nội', label: 'Nhà Hát Lớn / Hồ Gươm', fav: 0 },
  { name: 'Phường Hàng Bạc', lat: 21.0345, lon: 105.8520, admin1: 'Thành phố Hà Nội', region: 'Hà Nội', label: 'Phố Cổ 36 Phố Phường', fav: 0 },
  { name: 'Phường Ba Đình', lat: 21.0333, lon: 105.8340, admin1: 'Thành phố Hà Nội', region: 'Hà Nội', label: 'Quảng trường Ba Đình / Lăng Bác', fav: 0 },
  { name: 'Phường Giảng Võ', lat: 21.0280, lon: 105.8190, admin1: 'Thành phố Hà Nội', region: 'Hà Nội', label: 'Hồ Giảng Võ / Đống Đa', fav: 0 },
  { name: 'Phường Bách Khoa', lat: 21.0060, lon: 105.8430, admin1: 'Thành phố Hà Nội', region: 'Hà Nội', label: 'Đại học Bách Khoa Hà Nội', fav: 0 },
  { name: 'Phường Dịch Vọng Hậu', lat: 21.0375, lon: 105.7925, admin1: 'Thành phố Hà Nội', region: 'Hà Nội', label: 'Cầu Giấy / Phố Duy Tân', fav: 0 },
  { name: 'Phường Mễ Trì', lat: 21.0180, lon: 105.7770, admin1: 'Thành phố Hà Nội', region: 'Hà Nội', label: 'Trung Tâm Hội Nghị Quốc Gia / Nam Từ Liêm', fav: 0 },

  // =========================================================================
  // 4. 28 TỈNH THEO BẢN ĐỒ HÀNH CHÍNH MỚI NHẤT VIỆT NAM
  // =========================================================================
  // --- Miền Bắc ---
  { name: 'Cao Bằng', lat: 22.6657, lon: 105.9723, admin1: 'Cao Bằng', region: 'Miền Bắc', label: 'Thác Bản Giốc', fav: 0 },
  { name: 'Tuyên Quang', lat: 21.8233, lon: 105.2155, admin1: 'Tuyên Quang', region: 'Miền Bắc', label: 'Tân Trào / Cao nguyên Hà Giang', fav: 0 },
  { name: 'Điện Biên', lat: 21.3855, lon: 103.0232, admin1: 'Điện Biên', region: 'Miền Bắc', label: 'Chiến trường Điện Biên Phủ', fav: 0 },
  { name: 'Lai Châu', lat: 22.3963, lon: 103.4682, admin1: 'Lai Châu', region: 'Miền Bắc', label: 'Dãy Hoàng Liên Sơn', fav: 0 },
  { name: 'Sơn La', lat: 21.3283, lon: 103.9148, admin1: 'Sơn La', region: 'Miền Bắc', label: 'Cao nguyên Mộc Châu', fav: 0 },
  { name: 'Lào Cai', lat: 22.4856, lon: 103.9707, admin1: 'Lào Cai', region: 'Miền Bắc', label: 'Sa Pa / Cửa khẩu Quốc tế', fav: 0 },
  { name: 'Phường Sa Pa', lat: 22.3364, lon: 103.8438, admin1: 'Lào Cai', region: 'Miền Bắc', label: 'Đỉnh Fansipan / Sa Pa', fav: 0 },
  { name: 'Thái Nguyên', lat: 21.5942, lon: 105.8481, admin1: 'Thái Nguyên', region: 'Miền Bắc', label: 'Vùng Chè Tân Cương / Hồ Ba Bể', fav: 0 },
  { name: 'Lạng Sơn', lat: 21.8537, lon: 106.7616, admin1: 'Lạng Sơn', region: 'Miền Bắc', label: 'Ải Chi Lăng / Cửa khẩu Hữu Nghị', fav: 0 },
  { name: 'Quảng Ninh', lat: 20.9505, lon: 107.0734, admin1: 'Quảng Ninh', region: 'Miền Bắc', label: 'Vịnh Hạ Long / Kỳ quan thế giới', fav: 0 },
  { name: 'Bắc Ninh', lat: 21.1861, lon: 106.0763, admin1: 'Bắc Ninh', region: 'Miền Bắc', label: 'Kinh Bắc / Thủ phủ công nghiệp', fav: 0 },
  { name: 'Phú Thọ', lat: 21.3227, lon: 105.4019, admin1: 'Phú Thọ', region: 'Miền Bắc', label: 'Đền Hùng / Tam Đảo / Mai Châu', fav: 0 },
  { name: 'Hưng Yên', lat: 20.6558, lon: 106.0514, admin1: 'Hưng Yên', region: 'Miền Bắc', label: 'Phố Hiến / Đồng bằng quê lúa', fav: 0 },
  { name: 'Ninh Bình', lat: 20.2524, lon: 105.9745, admin1: 'Ninh Bình', region: 'Miền Bắc', label: 'Quần thể Tràng An / Bái Đính', fav: 0 },

  // --- Miền Trung & Tây Nguyên ---
  { name: 'Thanh Hóa', lat: 19.8067, lon: 105.7852, admin1: 'Thanh Hóa', region: 'Miền Trung', label: 'Biển Sầm Sơn / Lam Kinh', fav: 0 },
  { name: 'Nghệ An', lat: 18.6796, lon: 105.6813, admin1: 'Nghệ An', region: 'Miền Trung', label: 'Quê Bác Nam Đàn / Cửa Lò', fav: 0 },
  { name: 'Hà Tĩnh', lat: 18.3433, lon: 105.9058, admin1: 'Hà Tĩnh', region: 'Miền Trung', label: 'Ngã ba Đồng Lộc / Vũng Áng', fav: 0 },
  { name: 'Quảng Trị', lat: 16.7500, lon: 107.1855, admin1: 'Quảng Trị', region: 'Miền Trung', label: 'Phong Nha Kẻ Bàng / Thành cổ', fav: 0 },
  { name: 'Quảng Ngãi', lat: 15.1205, lon: 108.7923, admin1: 'Quảng Ngãi', region: 'Miền Trung', label: 'Đảo Lý Sơn / Kỳ Co Quy Nhơn', fav: 0 },
  { name: 'Gia Lai', lat: 13.9833, lon: 108.0000, admin1: 'Gia Lai', region: 'Miền Trung', label: 'Biển Hồ Pleiku / Măng Đen', fav: 0 },
  { name: 'Khánh Hòa', lat: 12.2388, lon: 109.1967, admin1: 'Khánh Hòa', region: 'Miền Trung', label: 'Vịnh Nha Trang / Gành Đá Đĩa / Vĩnh Hy', fav: 0 },
  { name: 'Phường Lộc Thọ', lat: 12.2410, lon: 109.1940, admin1: 'Khánh Hòa', region: 'Miền Trung', label: 'Đường Trần Phú / Biển Nha Trang', fav: 0 },
  { name: 'Đắk Lắk', lat: 12.6667, lon: 108.0500, admin1: 'Đắk Lắk', region: 'Miền Trung', label: 'Thủ phủ Cà phê Buôn Ma Thuột', fav: 0 },
  { name: 'Lâm Đồng', lat: 11.9404, lon: 108.4583, admin1: 'Lâm Đồng', region: 'Miền Trung', label: 'Thành phố Ngàn Hoa Đà Lạt / Đồi Cát Mũi Né', fav: 0 },
  { name: 'Phường 1 (Đà Lạt)', lat: 11.9420, lon: 108.4380, admin1: 'Lâm Đồng', region: 'Miền Trung', label: 'Chợ Đà Lạt / Hồ Xuân Hương', fav: 0 },

  // --- Miền Nam & Đồng Bằng Sông Cửu Long ---
  { name: 'Đồng Nai', lat: 10.9574, lon: 106.8427, admin1: 'Đồng Nai', region: 'Miền Nam', label: 'TP. Biên Hòa / Rừng Nam Cát Tiên', fav: 0 },
  { name: 'Tây Ninh', lat: 11.3100, lon: 106.0983, admin1: 'Tây Ninh', region: 'Miền Nam', label: 'Núi Bà Đen / Cửa khẩu Mộc Bài / Tân An', fav: 0 },
  { name: 'Đồng Tháp', lat: 10.4578, lon: 105.6325, admin1: 'Đồng Tháp', region: 'Miền Nam', label: 'Làng hoa Sa Đéc / Mỹ Tho Tiền Giang', fav: 0 },
  { name: 'Vĩnh Long', lat: 10.2537, lon: 105.9722, admin1: 'Vĩnh Long', region: 'Miền Nam', label: 'Xứ Dừa Bến Tre / Cù lao Trà Vinh', fav: 0 },
  { name: 'An Giang', lat: 10.3833, lon: 105.4167, admin1: 'An Giang', region: 'Miền Nam', label: 'Núi Sam Châu Đốc / Quần đảo Phú Quốc', fav: 0 },
  { name: 'Phường Dương Đông', lat: 10.2167, lon: 103.9667, admin1: 'An Giang', region: 'Miền Nam', label: 'Trung tâm Đảo Ngọc Phú Quốc', fav: 0 },
  { name: 'Cà Mau', lat: 9.1769, lon: 105.1500, admin1: 'Cà Mau', region: 'Miền Nam', label: 'Cột mốc Mũi Cà Mau / Đất Mũi', fav: 0 }
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

  // Seed completed without forcing hardcoded default location
}

ensureSeedLocations();

