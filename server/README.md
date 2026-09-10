# PulseWeather Backend Architecture & Extension Guide

> Tài liệu kỹ thuật chi tiết dành cho kỹ sư phần mềm phụ trách bảo trì, mở rộng API, và tối ưu hóa hệ thống Backend của PulseWeather.

---

## 1. Cấu Trúc Thư Mục & Vai Trò Các Tệp Tin

```
server/
├── db.js              # Khởi tạo SQLite native (.db), schema định nghĩa bảng, seed dữ liệu TP.HCM & Miền Nam
├── retention.js       # Engine tự động dọn dẹp dữ liệu lịch sử quá 3 năm (Purge Cron)
├── security.js        # Cấu hình bảo mật Helmet, Rate Limiters, Input Sanitization, Masked Error Handler
├── weatherService.js  # Tích hợp & proxy Open-Meteo API (Forecast 16d, Geocoding, AQI, Archive 3 năm)
├── chromaService.js   # Module cầu nối Chroma DB (Vector search cho mẫu hình thời tiết)
└── index.js           # Express API Server, kết nối routes, middleware, và static serving
```

---

## 2. Thiết Kế Cơ Sở Dữ Liệu SQLite (`data/weather.db`)

Hệ thống sử dụng module `node:sqlite` (`DatabaseSync`) tích hợp sẵn trong Node.js, không phụ thuộc vào công cụ biên dịch C++ (node-gyp):

### 2.1. Bảng `locations`
Lưu trữ danh sách địa điểm theo dõi (CRUD):
- `id`: Khóa chính tự tăng (`INTEGER PRIMARY KEY AUTOINCREMENT`)
- `name`: Tên quận/huyện/thành phố (`TEXT NOT NULL`)
- `latitude`, `longitude`: Tọa độ địa lý chuẩn WGS84 (`REAL NOT NULL`)
- `admin1`: Tỉnh/thành trực thuộc (`TEXT`)
- `custom_label`: Nhãn do người dùng gắn (`TEXT`)
- `notes`: Ghi chú cá nhân (`TEXT`)
- `alert_rain_threshold`: Ngưỡng cảnh báo mưa (`INTEGER DEFAULT 60`)
- `is_favorite`: Cờ địa điểm ưu tiên (`INTEGER DEFAULT 0`)

### 2.2. Bảng `weather_snapshots`
Lưu trữ lịch sử thời tiết phục vụ phân tích xu hướng và đối chiếu 3 năm:
- `recorded_at`: Thời điểm ghi nhận (`TEXT DEFAULT (datetime('now'))`)
- Có đánh Index tại: `idx_snapshots_date`, `idx_snapshots_recorded_at`, `idx_snapshots_location`.

---

## 3. Cơ Chế Dọn Dẹp 3 Năm (Retention Engine)

Tệp `retention.js` chịu trách nhiệm duy trì giới hạn lưu trữ dữ liệu trong phạm vi 3 năm:
- **Nguyên tắc:** Xóa mọi bản ghi có `datetime(recorded_at) < datetime('now', '-3 years')`.
- **Lịch chạy:**
  1. Tự động chạy 1 lần ngay khi server khởi động.
  2. Định kỳ kích hoạt mỗi 24 giờ thông qua `setInterval`.
  3. Cho phép kích hoạt thủ công qua endpoint nội bộ `POST /api/admin/cleanup`.

---

## 4. Mô Hình Bảo Mật (Security Architecture)

Để đảm bảo không lộ thông tin nhạy cảm của người dùng khi truy cập:
1. **Reverse Proxy:** Trình duyệt người dùng **không bao giờ** gửi request trực tiếp đến máy chủ bên thứ ba (Open-Meteo). Toàn bộ được proxy qua `weatherService.js`.
2. **Helmet HTTP Headers:** Chặn đứng Clickjacking (`X-Frame-Options: DENY`), ép kiểu nội dung (`X-Content-Type-Options: nosniff`), và cấu hình chặt chẽ `Content-Security-Policy`.
3. **Rate Limiting:** Áp dụng giới hạn lưu lượng theo từng nhóm API (120 req/phút toàn cục; 60 req/phút cho tìm kiếm và CRUD) để ngăn chặn tấn công từ chối dịch vụ.
4. **SQL Parameterization:** Toàn bộ câu lệnh SQL sử dụng Prepared Statements (`db.prepare(...).run(...)`), triệt tiêu 100% lỗ hổng SQL Injection.
5. **Error Masking:** Middleware `secureErrorHandler` chặn bắt mọi ngoại lệ và chỉ trả về thông báo lỗi chuẩn hóa `{ error, code }`, tuyệt đối không rò rỉ stack trace hay đường dẫn hệ thống.

---

## 5. Hướng Dẫn Mở Rộng API Chuẩn Kiến Trúc

Khi cần bổ sung thêm endpoint mới:
1. **Định nghĩa hàm nghiệp vụ** trong module tương ứng (ví dụ: `weatherService.js` cho nghiệp vụ thời tiết hoặc `retention.js` cho thống kê).
2. **Đăng ký route** trong `server/index.js`.
3. **Áp dụng middleware bảo mật:** Luôn kèm `crudLimiter` hoặc `searchLimiter` cho các route mới.
4. **Viết test bổ sung** trong thư mục `test/api.test.js`.
5. **Chạy test:**
   ```bash
   npm test
   ```
