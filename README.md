# PulseWeather - Enterprise Weather Forecast & Climate Intelligence Platform

> **Hệ thống dự báo thời tiết cao cấp phong cách Apple Weather. Tích hợp dữ liệu Open-Meteo 16 ngày, lưu trữ và tự động dọn dẹp dữ liệu lịch sử 3 năm với SQLite native `.db`, bảo mật chuẩn Reverse Proxy, và môi trường Node.js cô lập cục bộ.**

---

## 📑 Mục Lục Tài Liệu Kỹ Thuật

Dự án được xây dựng theo tiêu chuẩn kiến trúc phần mềm cao cấp với tài liệu chi tiết cho từng phân hệ:
- 📖 [Backend Architecture Guide](file:///d:/Demo%20capstone/server/README.md) - Tài liệu kiến trúc máy chủ, SQLite schema, bộ dọn dẹp 3 năm và bảo mật.
- 🎨 [Frontend Component & Design System Guide](file:///d:/Demo%20capstone/src/README.md) - Tài liệu hệ thống giao diện Apple Weather, Spectrum Bar và cách phát triển widgets mới.

---

## ⚡ Hướng Dẫn Vận Hành & Khởi Động

### 1. Khởi chạy 1-Click (Môi trường Windows cô lập)
Nhấp đúp chuột vào file:
```bat
start.bat
```
Hoặc khởi chạy từ PowerShell:
```powershell
.\run.ps1
```
Ứng dụng sẽ tự động kích hoạt binary Node.js trong `.runtime/nodejs`, thiết lập cấu hình và phục vụ tại: **http://localhost:5000**.

### 2. Khởi chạy thủ công từ Terminal
```bash
# Thiết lập PATH ưu tiên runtime nội bộ của dự án
set "PATH=%cd%\.runtime\nodejs;%PATH%"

# Đóng gói giao diện & khởi chạy máy chủ
npm run build
npm start
```

---

## 🏛️ Sơ Đồ Kiến Trúc Hệ Thống (System Architecture)

```
[ Trình Duyệt Client (Apple Weather UI - React 19) ]
                         │
        (Reverse Proxy & Security Barrier)
                         ▼
        [ Express API Gateway (Port 5000) ]
        ├── Helmet Security Headers
        ├── Rate Limiting (120 req/min)
        ├── Parameter Sanitizer & Error Masking
        ├── SQLite Prepared Statements
        │
        ├──► [ data/weather.db (Native SQLite Database) ]
        │     ├── Bảng locations (Tất cả quận TP.HCM & các tỉnh Miền Nam)
        │     ├── Bảng weather_snapshots (Lưu lịch sử chu kỳ 3 năm)
        │     └── Retention Engine (Cron tự động dọn dẹp bản ghi > 3 năm)
        │
        ├──► [ Chroma DB Vector Service ]
        │     └── Collection weather_vectors (Truy vấn ngữ nghĩa & Fallback)
        │
        └──► [ Open-Meteo Gateway ]
              ├── Geocoding Search API
              ├── 16-Day Extended Forecast API (Tối đa giới hạn API)
              ├── 24-Hour Hourly Timeline & AQI
              └── Historical Archive API (Đối chiếu khí hậu 3 năm)
```

---

## 📍 Hạt Giống Tọa Độ Khu Vực TP.HCM & Miền Nam

Hệ thống được thiết lập sẵn tọa độ địa lý mới nhất của toàn bộ khu vực trọng điểm phía Nam:
- **TP. Hồ Chí Minh (22 Quận/Huyện/TP):** Quận 1 *(mặc định)*, TP. Thủ Đức, Quận 3, Quận 4, Quận 5, Quận 6, Quận 7, Quận 8, Quận 10, Quận 11, Quận 12, Bình Thạnh, Gò Vấp, Phú Nhuận, Tân Bình, Tân Phú, Bình Tân, Nhà Bè, Hóc Môn, Củ Chi, Bình Chánh, Cần Giờ.
- **Đông Nam Bộ:** Bình Dương, Đồng Nai, Bà Rịa - Vũng Tàu, Tây Ninh, Bình Phước.
- **Đồng bằng Sông Cửu Long (Tây Nam Bộ):** Cần Thơ, Long An, Tiền Giang, Bến Tre, Trà Vinh, Vĩnh Long, Đồng Tháp, An Giang, Kiên Giang (Phú Quốc), Hậu Giang, Sóc Trăng, Bạc Liêu, Cà Mau.

---

## 🍎 Ngôn Ngữ Thiết Kế Apple Weather (iOS / macOS)

1. **Hiệu ứng khí quyển 100% Live:** Hoạt ảnh Canvas 60fps tự động thích ứng với diễn biến thời tiết thực tế (Trời nắng, Đêm sao, Mưa rơi, Sấm sét, Tuyết, Sương mù) dựa trên mã WMO Open-Meteo.
2. **Apple Frosted Glass:** Hiệu ứng kính mờ đa lớp (`backdrop-filter: blur(40px) saturate(190%)`) với đường viền siêu mảnh tinh tế.
3. **Thanh phổ nhiệt độ Apple Spectrum Bar:** Hiển thị dải nhiệt độ tối thiểu - tối đa trực quan cho chuỗi dự báo 16 ngày kèm điểm nhiệt độ hiện tại.
4. **Mô-đun thông số 2 cột:** Chất lượng không khí (AQI), Chỉ số tia UV, Gió & La bàn, Mặt trời mọc/lặn, Cảm giác như, và Độ ẩm/Điểm sương.
5. **Xu hướng khí hậu 3 năm:** Đối chiếu nhiệt độ hôm nay so với cùng ngày cách đây 1 năm, 2 năm và 3 năm.

---

## 🛡️ Tiêu Chuẩn Bảo Mật & Bảo Vệ Thông Tin

- **Zero Client Leakage:** Trình duyệt người dùng không trực tiếp gọi API ngoài; toàn bộ được xử lý qua reverse proxy ở backend.
- **Helmet Headers:** Kích hoạt `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
- **Rate Limiting:** Kiểm soát lưu lượng 120 req/phút toàn hệ thống nhằm phòng chống khai thác và DoS.
- **SQL Injection Immunity:** 100% truy vấn cơ sở dữ liệu qua Prepared Statements.
- **Error Masking:** Tuyệt đối không rò rỉ stack trace hay cấu trúc thư mục máy chủ khi có lỗi phát sinh.

---

## 📡 Danh Mục API (API Reference)

| Giao thức | Đường dẫn | Chức năng |
|---|---|---|
| `GET` | `/api/locations` | Lấy danh sách địa điểm theo dõi đã lưu |
| `POST` | `/api/locations` | Thêm địa điểm mới kèm nhãn, ghi chú, cảnh báo |
| `PUT` | `/api/locations/:id` | Cập nhật nhãn, ghi chú, ngưỡng mưa, ưu tiên |
| `DELETE` | `/api/locations/:id` | Xóa địa điểm khỏi cơ sở dữ liệu SQLite |
| `GET` | `/api/weather/search?q=` | Tìm kiếm thành phố toàn cầu (Geocoding) |
| `GET` | `/api/weather/forecast?lat=&lon=&city=` | Dự báo 16 ngày, 24 giờ chi tiết, và AQI |
| `GET` | `/api/weather/compare-history?lat=&lon=` | Đối chiếu thời tiết hôm nay với 1, 2, 3 năm trước |
| `GET` | `/api/system/status` | Báo cáo chẩn đoán dung lượng DB, retention và bảo mật |
| `POST` | `/api/admin/cleanup` | Kích hoạt quét dọn dữ liệu lịch sử quá 3 năm |

---

## 🧪 Kiểm Thử Tự Động (Testing)

```bash
npm test
```
Kiểm thử tự động bao gồm: Kiểm tra thẩm định tọa độ, lọc mã độc XSS, kiểm tra toàn diện CRUD trên SQLite, và xác minh thuật toán dọn dẹp dữ liệu quá 3 năm.
