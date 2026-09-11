# 🍄 PulseWeather Frontend Architecture & API Management Guide

> **Tài Liệu Quy Chuẩn Lập Trình Frontend:** Hướng dẫn phát triển, quy tắc kiến trúc Single Source of Truth, và cách sử dụng module quản lý API độc lập `src/services/weatherApi.js`.

---

## 1. ⚠️ QUY TẮC CỐT LÕI (MANDATORY RULE FOR DEVELOPERS)

> [!CAUTION]
> **TUYỆT ĐỐI KHÔNG GỌI `fetch()` TRỰC TIẾP TRONG CÁC REACT COMPONENT!**
> 
> Việc rải rác các lệnh `fetch()` trực tiếp trong các component (như `App.jsx`, `QuickMetrics.jsx`, `LocationManager.jsx`, v.v.) bị nghiêm cấm vì:
> 1. Gây khó khăn khi debug lỗi mạng, lỗi CORS, hoặc quản lý timeout.
> 2. Dẫn đến trùng lặp mã nguồn khi nhiều component cùng cần một loại dữ liệu.
> 3. Làm mất tính nhất quán giữa cơ chế Server Proxy và Client-side Fallback khi máy chủ gặp tình trạng cold-start.
>
> **Mọi tương tác mạng PHẢI được định nghĩa và xuất khẩu từ:**
> 👉 **`src/services/weatherApi.js`**

---

## 2. Cấu Trúc Thư Mục Frontend

```
src/
├── services/
│   └── weatherApi.js           # 🚀 MODULE ĐỘC LẬP QUẢN LÝ 100% API, GPS, DUAL-ENGINE FALLBACK
├── components/
│   ├── WeatherCanvas.jsx       # Hiệu ứng khí quyển nền 3D/Canvas mượt mà theo thời tiết thực tế
│   ├── WeatherHero.jsx         # Card thời tiết trung tâm (Apple Weather Glassmorphism)
│   ├── QuickMetrics.jsx        # 12 Modular widgets (AQI, UV, Gió, Điểm sương, Độ ẩm, VPD, v.v.)
│   ├── MushroomAgroMetrics.jsx # Hệ thống nông nghiệp vi khí hậu & 4 tầng độ ẩm đất trồng nấm
│   ├── HourlySlider.jsx        # Thanh trượt 24 giờ thời tiết chi tiết
│   ├── Forecast16Days.jsx      # Dự báo hàng ngày Apple (8 ngày mặc định, mở rộng 16 ngày)
│   ├── LocationManager.jsx     # Quản lý 207+ địa điểm, tìm kiếm mờ Fuse.js & bản đồ OSM
│   ├── HistoricalComparator.jsx# So sánh khí hậu lịch sử 3 năm cùng kỳ
│   ├── ChromaModal.jsx         # Tìm kiếm hình thái thời tiết bằng ChromaDB Vector AI
│   └── SystemModal.jsx         # Dashboard trạng thái hệ thống, SQLite & dọn dẹp dữ liệu
├── utils/
│   ├── searchEngine.js         # Động cơ tìm kiếm mờ tiếng Việt không dấu (Fuse.js diacritic-folding)
│   └── weatherIcons.js         # Bộ icon khí tượng Apple WMO chuẩn
├── App.jsx                     # Component gốc điều phối trạng thái (Chỉ import từ weatherApi.js)
├── main.jsx                    # Điểm gắn kết React 19 Root
└── index.css                   # Hệ thống CSS Apple Glassmorphism Design Tokens
```

---

## 3. Danh Mục Các Hàm Trong Module `src/services/weatherApi.js`

### 3.1. Quản Lý Địa Điểm (Locations CRUD)
```javascript
import { 
  getTrackedLocations, 
  createLocation, 
  updateLocation, 
  deleteLocation 
} from '../services/weatherApi';

// 1. Tải danh sách địa điểm đã lưu từ SQLite
const locations = await getTrackedLocations();

// 2. Thêm địa điểm mới
const newLoc = await createLocation({
  name: 'Phường Thới An',
  latitude: 10.8656,
  longitude: 106.6625,
  admin1: 'TP. Hồ Chí Minh',
  region: 'TP.HCM',
  custom_label: 'UBND Quận 12 / Lê Thị Riêng'
});

// 3. Cập nhật nhãn / yêu thích
await updateLocation(locId, { is_favorite: 1 });

// 4. Xóa địa điểm
await deleteLocation(locId);
```

### 3.2. Định Vị GPS Client Tự Động & Reverse Geocoding
Khi người dùng truy cập web, ứng dụng không ép buộc vị trí cố định mà gọi hàm:
```javascript
import { detectClientGeoLocation } from '../services/weatherApi';

try {
  // Lấy tọa độ GPS thiết bị và tự động phân giải tên Phường/Xã/Quận qua OSM Nominatim
  const clientLocation = await detectClientGeoLocation();
  console.log(clientLocation.name); // vd: "Phường Thới An, Quận 12" hoặc "Phường 25, Bình Thạnh"
} catch (err) {
  // Người dùng từ chối cấp quyền -> tự động fallback về địa điểm mặc định an toàn
}
```

### 3.3. Tải Dự Báo Thời Tiết & Chỉ Số Vi Khí Hậu (Dual-Engine Fallback)
```javascript
import { fetchFullWeatherForecast } from '../services/weatherApi';

// Tải đầy đủ: Hiện tại, 24 giờ tới, 16 ngày tới, 4 tầng độ ẩm đất, áp suất hơi thiếu hụt VPD,
// chỉ số phù hợp cho 5 giống nấm Việt Nam (Nấm Rơm, Bào Ngư, Mối Đen, Linh Chi, Mộc Nhĩ).
const forecastData = await fetchFullWeatherForecast(activeLocation);
```
- **Cơ chế Dual-Engine**:
  - Giai đoạn 1: Gửi request đến Server Proxy với timeout 3.5s.
  - Giai đoạn 2: Nếu serverless backend gặp cold-start hoặc timeout, tự động chuyển đổi trong 0 giây sang direct Open-Meteo Client Engine, đảm bảo giao diện **KHÔNG BAO GIỜ** bị treo hay báo lỗi trắng trang.

### 3.4. Tìm Kiếm Địa Điểm Mở Rộng Toàn Quốc (Search API)
```javascript
import { searchLocationsApi } from '../services/weatherApi';

// Tra cứu mọi xã/phường/thị trấn tại Việt Nam
const searchResults = await searchLocationsApi('Thới An');
```

### 3.5. Hệ Thống & ChromaDB Vector AI
```javascript
import { 
  fetchSystemStatus, 
  fetchHistoricalComparison, 
  triggerAdminCleanup, 
  fetchChromaStatus, 
  syncChromaDatabase, 
  queryChromaVector 
} from '../services/weatherApi';
```

---

## 4. Hướng Dẫn Thêm Tính Năng Mới Cho Nhà Phát Triển

Khi cần kết nối thêm API mới (ví dụ: API vệ tinh rada, dự báo chất lượng đất chi tiết):
1. **Bước 1**: Mở tệp `src/services/weatherApi.js`.
2. **Bước 2**: Viết hàm bất đồng bộ mới, xử lý đầy đủ `try...catch`, chuẩn hóa kiểu dữ liệu trả về, và thiết lập cơ chế fallback an toàn nếu có sự cố mạng.
3. **Bước 3**: Export hàm đó ra khỏi module.
4. **Bước 4**: Tại React Component cần dùng dữ liệu, import hàm từ `../services/weatherApi` và gọi thực thi.
