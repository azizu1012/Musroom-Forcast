# PulseWeather Frontend Architecture & Component Guide

> Tài liệu hướng dẫn phát triển và mở rộng giao diện người dùng theo ngôn ngữ thiết kế **Apple Weather (iOS / macOS)** cho PulseWeather.

---

## 1. Cấu Trúc Thư Mục Frontend

```
src/
├── components/
│   ├── WeatherCanvas.jsx        # Canvas 60fps hoạt ảnh khí quyển tự động theo WMO
│   ├── WeatherHero.jsx          # Apple Hero: Thành phố, nhiệt độ khổng lồ, khoảng H/L
│   ├── HourlySlider.jsx         # Dự báo 24 giờ dạng thanh cuộn ngang mượt mà
│   ├── Forecast16Days.jsx       # Dự báo 16 ngày kèm thanh phổ nhiệt độ Apple Spectrum Bar
│   ├── QuickMetrics.jsx         # Hệ thống widget Apple 2 cột (AQI, UV, Gió, Mặt trời, Độ ẩm, Cảm giác như)
│   ├── HistoricalComparator.jsx # Xu hướng khí hậu 3 năm
│   ├── LocationManager.jsx      # Quản lý địa điểm đã lưu (Lọc TP.HCM / Miền Nam & CRUD)
│   └── SystemModal.jsx          # Bảng thông tin hệ thống & trạng thái bảo mật dạng Apple Sheet
├── utils/
│   └── weatherIcons.jsx         # Ánh xạ mã WMO Open-Meteo sang icon và văn bản tiếng Việt
├── App.jsx                      # Component gốc điều phối trạng thái (Single Source of Truth)
├── index.css                    # Design system Apple Weather (Kính mờ, Spectrum bar, Typography)
└── main.jsx                     # Điểm khởi tạo React 19
```

---

## 2. Hệ Thống Thiết Kế (Apple Weather Design System)

Tất cả các thành phần trong `src/index.css` tuân thủ các quy tắc thiết kế của Apple Weather:

### 2.1. Frosted Glass Material
```css
.apple-widget {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(40px) saturate(190%);
  -webkit-backdrop-filter: blur(40px) saturate(190%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 22px;
  box-shadow: 0 12px 36px -8px rgba(0, 0, 0, 0.4);
}
```

### 2.2. Header Mô-đun Chuẩn Apple
Tiêu đề widget luôn dùng cỡ chữ nhỏ (0.75rem), in hoa, kèm icon đại diện:
```jsx
<div className="widget-header">
  <Sun size={14} />
  <span>Chỉ Số UV</span>
</div>
```

### 2.3. Thanh Phổ Nhiệt Độ Apple Spectrum Bar
Trong `Forecast16Days.jsx`, dải phổ màu được tính toán theo tỷ lệ tương quan giữa nhiệt độ thấp nhất/cao nhất của ngày so với biên độ toàn chuỗi 16 ngày:
```javascript
const leftPercent = ((day.tempMin - globalMin) / tempSpan) * 100;
const widthPercent = ((day.tempMax - day.tempMin) / tempSpan) * 100;
```

---

## 3. Hướng Dẫn Thêm Widget Khí Quyển Mới

Khi muốn bổ sung thêm một widget mới (ví dụ: Tầm nhìn xa, Áp suất chi tiết, hoặc Chu kỳ mặt trăng):
1. **Mở `src/components/QuickMetrics.jsx`** (hoặc tạo file mới trong `src/components/`).
2. **Kế thừa cấu trúc `.apple-widget`**:
```jsx
<div className="apple-widget">
  <div className="widget-header">
    <Eye size={14} />
    <span>Tầm Nhìn Xa</span>
  </div>

  <div className="widget-main-value">
    10 <span style={{ fontSize: '1.1rem', fontWeight: 400 }}>km</span>
  </div>

  <div className="widget-footer-note">
    Tầm nhìn hoàn toàn quang đãng và rõ ràng.
  </div>
</div>
```
3. Widget sẽ tự động co giãn và căn đều trong lưới hiển thị `.apple-widgets-grid` 2 cột trên desktop và 1 cột trên điện thoại.

---

## 4. Quy Trình Kiểm Thử & Đóng Gói

```bash
# Kiểm tra định dạng và build production với Vite
npm run build

# Xem trước bản đóng gói
npm run preview
```
Bản đóng gói cuối cùng sẽ được đưa vào thư mục `dist/` để Express Server phục vụ trực tiếp tại cổng `5000`.
