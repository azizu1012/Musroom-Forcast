/**
 * =========================================================================
 * PULSEWEATHER API & GEOLOCATION SERVICE MODULE (SINGLE SOURCE OF TRUTH)
 * =========================================================================
 * Toàn bộ các tương tác mạng (REST API, Reverse Geocoding, Client GPS, 
 * Serverless Fallback, và Thuật toán Nông nghiệp Trồng Nấm) được quản lý 
 * tập trung tại module này. 
 * Tuyệt đối KHÔNG viết fetch() phân tán trong các React Component.
 */

// Đơn vị đo & hằng số mặc định
export const DEFAULT_FALLBACK_LOCATION = {
  id: 'local_fallback',
  name: 'TP. Hồ Chí Minh',
  latitude: 10.8231,
  longitude: 106.6297,
  country: 'Vietnam',
  admin1: 'TP. Hồ Chí Minh',
  region: 'TP.HCM',
  custom_label: 'Trung tâm Nam Bộ',
  is_favorite: 1
};

/**
 * 1. QUẢN LÝ ĐỊA ĐIỂM (LOCATIONS CRUD)
 */
export async function getTrackedLocations() {
  const res = await fetch('/api/locations');
  if (!res.ok) throw new Error(`Lỗi tải danh sách địa điểm: ${res.status}`);
  return await res.json();
}

export async function createLocation(payload) {
  const res = await fetch('/api/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Không thể tạo địa điểm');
  }
  return await res.json();
}

export async function updateLocation(id, payload) {
  const res = await fetch(`/api/locations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Không thể cập nhật địa điểm');
  }
  return await res.json();
}

export async function deleteLocation(id) {
  const res = await fetch(`/api/locations/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Không thể xóa địa điểm');
  }
  return true;
}

/**
 * 2. TÌM KIẾM ĐỊA ĐIỂM (SEARCH ENGINE PROXY / FALLBACK)
 */
export async function searchLocationsApi(query) {
  if (!query || query.trim().length < 2) return [];
  const cleanQ = encodeURIComponent(query.trim());

  // Thử qua backend proxy (đã tích hợp cache & Nominatim)
  try {
    const res = await fetch(`/api/weather/search?q=${cleanQ}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.warn('[API SERVICE] Backend search proxy warning:', err);
  }

  // Client-side fallback qua Open-Meteo Geocoding
  try {
    const omRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${cleanQ}&count=8&language=vi&format=json&country_code=VN`
    );
    if (omRes.ok) {
      const omData = await omRes.json();
      if (omData.results) {
        return omData.results.map((item, idx) => ({
          id: `om_${item.id || idx}`,
          name: item.name,
          latitude: parseFloat(item.latitude.toFixed(4)),
          longitude: parseFloat(item.longitude.toFixed(4)),
          country: 'Vietnam',
          admin1: item.admin1 || 'Việt Nam',
          region: item.latitude >= 19.5 ? 'Miền Bắc' : (item.latitude >= 11.5 ? 'Miền Trung' : 'Miền Nam'),
          display_name: `${item.name}, ${item.admin1 || 'Việt Nam'}`
        }));
      }
    }
  } catch (err) {
    console.error('[API SERVICE] Fallback geocoding error:', err);
  }

  return [];
}

/**
 * 3. ĐỊNH VỊ GPS CLIENT TỰ ĐỘNG & REVERSE GEOCODING
 * Lấy tọa độ thực tế của người dùng đang truy cập web và truy ngược ra tên Phường/Xã/Tỉnh
 */
export async function detectClientGeoLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Trình duyệt không hỗ trợ định vị Geolocation'));
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(4));
        const lon = parseFloat(pos.coords.longitude.toFixed(4));

        try {
          // Reverse Geocoding qua OpenStreetMap Nominatim
          const revUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=vi`;
          const res = await fetch(revUrl, {
            headers: { 'User-Agent': 'PulseWeatherClientGPS/1.0' }
          });

          let locationName = 'Vị Trí Của Bạn';
          let admin1 = 'TP. Hồ Chí Minh';
          let region = 'TP.HCM';

          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            // Ưu tiên: Phường/Xã -> Quận/Huyện -> Thành phố
            const suburb = addr.quarter || addr.suburb || addr.village || addr.town;
            const district = addr.city_district || addr.district || addr.county;
            const city = addr.city || addr.state || addr.province || 'Việt Nam';

            if (suburb && district) {
              locationName = `${suburb}, ${district}`;
            } else if (suburb) {
              locationName = suburb;
            } else if (district) {
              locationName = district;
            } else {
              locationName = city;
            }

            admin1 = city;
            if (lat >= 19.5) region = 'Miền Bắc';
            else if (lat >= 11.5) region = 'Miền Trung';
            else if (admin1.toLowerCase().includes('hồ chí minh') || admin1.toLowerCase().includes('thủ đức')) region = 'TP.HCM';
            else region = 'Miền Nam';
          }

          resolve({
            id: 'client_gps_active',
            name: locationName,
            latitude: lat,
            longitude: lon,
            country: 'Vietnam',
            admin1: admin1,
            region: region,
            custom_label: 'Vị Trí Hiện Tại (GPS Trình Duyệt)',
            is_gps: true,
            is_favorite: 1
          });
        } catch (err) {
          // Khi reverse geocoding gặp lỗi mạng, vẫn trả về tọa độ GPS chính xác
          resolve({
            id: 'client_gps_active',
            name: `Tọa độ (${lat}, ${lon})`,
            latitude: lat,
            longitude: lon,
            country: 'Vietnam',
            admin1: 'Việt Nam',
            region: lat >= 19.5 ? 'Miền Bắc' : (lat >= 11.5 ? 'Miền Trung' : 'Miền Nam'),
            custom_label: 'Vị Trí GPS Client',
            is_gps: true,
            is_favorite: 1
          });
        }
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000
      }
    );
  });
}

/**
 * 4. THỜI TIẾT TỔNG HỢP & CHỈ SỐ NÔNG NGHIỆP TRỒNG NẤM
 * Hỗ trợ Dual-Engine: Server proxy + Direct Client Fallback khi cold start
 */
export async function fetchFullWeatherForecast(loc) {
  if (!loc || loc.latitude == null || loc.longitude == null) {
    throw new Error('Vị trí không hợp lệ để tải dự báo thời tiết');
  }

  const { latitude: lat, longitude: lon, name: cityName } = loc;
  const locId = loc.id && typeof loc.id === 'number' ? loc.id : '';

  // 1. Thử qua Server Proxy với Timeout 3.5s (ngăn chặn cold-start block)
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(
      `/api/weather/forecast?lat=${lat}&lon=${lon}&city=${encodeURIComponent(cityName)}&locationId=${locId}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutTimer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.current) return data;
    }
  } catch (proxyErr) {
    console.warn('[API SERVICE] Server proxy delayed or warming up. Falling back to direct engine:', proxyErr.message);
  }

  // 2. Direct Client Fallback trực tiếp qua Open-Meteo API
  return await fetchDirectOpenMeteoEngine(lat, lon, cityName);
}

/**
 * Thuật toán tính toán chỉ số trồng nấm nông nghiệp vi khí hậu
 */
export function calculateMushroomAgroScores({ temp, humidity, dewPoint, vpd, soilMoist0_1, soilMoist1_3, soilTemp0, soilTemp6 }) {
  // 1. Độ ẩm không khí (Lý tưởng: 80% - 92%)
  let rhScore = 0;
  if (humidity >= 80 && humidity <= 92) rhScore = 100;
  else if (humidity >= 72 && humidity < 80) rhScore = 82;
  else if (humidity > 92 && humidity <= 97) rhScore = 88;
  else if (humidity >= 60 && humidity < 72) rhScore = 60;
  else rhScore = 35;

  // 2. Áp suất hơi thiếu hụt VPD (Vùng vàng: 0.3 - 0.75 kPa)
  let vpdScore = 0;
  if (vpd >= 0.3 && vpd <= 0.75) vpdScore = 100;
  else if ((vpd >= 0.2 && vpd < 0.3) || (vpd > 0.75 && vpd <= 0.95)) vpdScore = 80;
  else if (vpd > 0.95 && vpd <= 1.25) vpdScore = 55;
  else vpdScore = 30;

  // 3. Độ ẩm cơ chất đất (Ngưỡng vàng: 28% - 42% vol)
  const moistAvg = ((soilMoist0_1 || 32) + (soilMoist1_3 || 34)) / 2;
  let moistScore = 0;
  if (moistAvg >= 28 && moistAvg <= 42) moistScore = 100;
  else if (moistAvg >= 22 && moistAvg < 28) moistScore = 75;
  else if (moistAvg > 42 && moistAvg <= 50) moistScore = 70;
  else moistScore = 45;

  const overallScore = Math.round(rhScore * 0.4 + vpdScore * 0.35 + moistScore * 0.25);

  let status = 'Môi Trường Lý Tưởng Phát Triển Quả Thể';
  let statusColor = '#34d399';
  let actionAdvice = 'Khí hậu và ẩm độ đang trong vùng vàng (Golden Zone) để kích thích mầm nấm phát triển mọc rộ.';

  if (vpd > 1.05 || humidity < 68) {
    status = 'Cảnh Báo Khô Hạn - Cần Phun Sương Ẩm';
    statusColor = '#fb923c';
    actionAdvice = 'Không khí khô bốc hơi nhanh, nguy cơ nứt teo mũ nấm. Cần bật béc phun sương mù 15-20 phút và kéo bạt chắn gió lùa.';
  } else if (vpd < 0.22 || humidity > 95) {
    status = 'Ẩm Bão Hòa - Cần Thông Gió Thoát Ẩm';
    statusColor = '#38bdf8';
    actionAdvice = 'Nguy cơ đọng màng nước trên quả thể gây thối nhũn và mốc trichoderma. Hãy mở cửa thông gió đối lưu và giảm lượng tưới.';
  } else if (temp > 35) {
    status = 'Nhiệt Độ Cao - Cần Hạ Nhiệt Trại Nấm';
    statusColor = '#f87171';
    actionAdvice = 'Nhiệt độ môi trường vượt ngưỡng chịu đựng của tơ nấm. Nên phun nước làm mát mái trại và giữ thoáng khí.';
  }

  const species = [
    {
      name: 'Nấm Rơm',
      scientific: 'Volvariella volvacea',
      optTemp: '30 - 35°C',
      optHumidity: '80 - 90%',
      optMoist: '32 - 40%',
      score: Math.max(30, Math.min(100, Math.round(100 - Math.abs(temp - 32) * 5.5 - Math.abs(humidity - 85) * 1.5))),
      suitability: temp >= 28 && temp <= 36 && humidity >= 75 ? 'Rất Thích Hợp' : (temp < 25 ? 'Hơi Lạnh (Cần Ủ Áo Giữ Nhiệt)' : 'Khá Thích Hợp'),
      note: 'Ưa ấm nhiệt đới. Khi quả thể dạng búp cần duy trì ẩm độ luống rơm 65-70%.'
    },
    {
      name: 'Nấm Bào Ngư / Nấm Sò',
      scientific: 'Pleurotus spp.',
      optTemp: '22 - 28°C',
      optHumidity: '85 - 90%',
      optMoist: '28 - 38%',
      score: Math.max(30, Math.min(100, Math.round(100 - Math.abs(temp - 25) * 6 - Math.abs(humidity - 88) * 1.5))),
      suitability: temp >= 20 && temp <= 29 && humidity >= 78 ? 'Rất Thích Hợp' : (temp > 32 ? 'Nắng Nóng (Cần Phun Mát)' : 'Khá Thích Hợp'),
      note: 'Dễ trồng, cho năng suất cao. Tuyệt đối không tưới thẳng nước lạnh vào cổ bịch phôi.'
    },
    {
      name: 'Nấm Mối / Nấm Mối Đen',
      scientific: 'Termitomyces / Oudemansiella',
      optTemp: '25 - 30°C',
      optHumidity: '85 - 95%',
      optMoist: '35 - 45%',
      score: Math.max(30, Math.min(100, Math.round(100 - Math.abs(temp - 27) * 5 - Math.abs(humidity - 90) * 1.2))),
      suitability: temp >= 23 && temp <= 31 && humidity >= 80 ? 'Rất Thích Hợp' : 'Cần Tăng Độ Ẩm Đất',
      note: 'Ưa tầng đất ẩm sâu và mùn hữu cơ. Rất nhạy cảm với sự chênh lệch ẩm độ ngày đêm.'
    },
    {
      name: 'Nấm Linh Chi',
      scientific: 'Ganoderma lucidum',
      optTemp: '22 - 28°C',
      optHumidity: '80 - 85%',
      optMoist: '25 - 35%',
      score: Math.max(30, Math.min(100, Math.round(100 - Math.abs(temp - 25) * 5 - Math.abs(humidity - 82) * 2))),
      suitability: temp >= 20 && temp <= 30 && humidity >= 75 ? 'Rất Thích Hợp' : 'Trung Bình',
      note: 'Dược liệu quý. Cần ánh sáng khuếch tán đồng đều để quả thể phân nhánh xòe đẹp.'
    },
    {
      name: 'Nấm Mèo / Mộc Nhĩ',
      scientific: 'Auricularia auricula',
      optTemp: '25 - 32°C',
      optHumidity: '80 - 90%',
      optMoist: '28 - 38%',
      score: Math.max(30, Math.min(100, Math.round(100 - Math.abs(temp - 28) * 5 - Math.abs(humidity - 85) * 1.5))),
      suitability: temp >= 24 && temp <= 33 && humidity >= 75 ? 'Rất Thích Hợp' : 'Khá Thích Hợp',
      note: 'Khả năng chịu nhiệt tốt, tốc độ lớn nhanh khi độ ẩm không khí đạt trên 85%.'
    }
  ];

  return {
    overallScore,
    status,
    statusColor,
    actionAdvice,
    vpdStatus: vpd >= 0.3 && vpd <= 0.75 ? 'Tối ưu (0.3 - 0.75 kPa)' : (vpd > 0.75 ? 'Hơi Khô (Thoát Hơi Nhanh)' : 'Ẩm Bão Hòa'),
    species
  };
}

/**
 * Hàm gọi trực tiếp Open-Meteo công khai
 */
async function fetchDirectOpenMeteoEngine(lat, lon, cityName) {
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m,uv_index,visibility,dew_point_2m,vapor_pressure_deficit,soil_temperature_0cm,soil_temperature_6cm,soil_temperature_18cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,et0_fao_evapotranspiration,shortwave_radiation` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,precipitation_hours,wind_speed_10m_max,wind_gusts_10m_max,et0_fao_evapotranspiration,shortwave_radiation_sum` +
    `&timezone=auto&forecast_days=16`;

  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide`;

  const [fRes, aRes] = await Promise.allSettled([
    fetch(forecastUrl).then((r) => r.json()),
    fetch(aqiUrl).then((r) => r.json())
  ]);

  if (fRes.status !== 'fulfilled' || !fRes.value?.daily) {
    throw new Error('Không thể tải dữ liệu thời tiết trực tiếp từ Open-Meteo');
  }

  const fData = fRes.value;
  const aData = aRes.status === 'fulfilled' ? aRes.value : null;

  const hourlyTimes = fData.hourly?.time || [];
  const currentTimeStr = fData.current?.time || fData.current_weather?.time || new Date().toISOString().slice(0, 13);
  let startIndex = hourlyTimes.findIndex((t) => t >= currentTimeStr);
  if (startIndex < 0) startIndex = 0;

  const next24h = [];
  for (let i = startIndex; i < Math.min(startIndex + 24, hourlyTimes.length); i++) {
    next24h.push({
      time: hourlyTimes[i],
      temperature: fData.hourly.temperature_2m?.[i],
      apparentTemperature: fData.hourly.apparent_temperature?.[i],
      humidity: fData.hourly.relative_humidity_2m?.[i] ?? 65,
      dewPoint: fData.hourly.dew_point_2m?.[i] ?? 22,
      vpd: fData.hourly.vapor_pressure_deficit?.[i] != null ? +(fData.hourly.vapor_pressure_deficit[i].toFixed(2)) : 0.8,
      precipitationProbability: fData.hourly.precipitation_probability?.[i] ?? 0,
      precipitation: fData.hourly.precipitation?.[i] ?? 0,
      weatherCode: fData.hourly.weather_code?.[i],
      windSpeed: fData.hourly.wind_speed_10m?.[i],
      uvIndex: fData.hourly.uv_index?.[i] ?? 0,
      soilTemperature0cm: fData.hourly.soil_temperature_0cm?.[i] ?? fData.hourly.temperature_2m?.[i],
      soilTemperature6cm: fData.hourly.soil_temperature_6cm?.[i] ?? (fData.hourly.temperature_2m?.[i] ? +(fData.hourly.temperature_2m[i] - 1.5).toFixed(1) : 26),
      soilTemperature18cm: fData.hourly.soil_temperature_18cm?.[i] ?? 25,
      soilMoisture0To1cm: fData.hourly.soil_moisture_0_to_1cm?.[i] != null ? +(fData.hourly.soil_moisture_0_to_1cm[i] * 100).toFixed(1) : 32.5,
      soilMoisture1To3cm: fData.hourly.soil_moisture_1_to_3cm?.[i] != null ? +(fData.hourly.soil_moisture_1_to_3cm[i] * 100).toFixed(1) : 34.0,
      soilMoisture3To9cm: fData.hourly.soil_moisture_3_to_9cm?.[i] != null ? +(fData.hourly.soil_moisture_3_to_9cm[i] * 100).toFixed(1) : 35.5,
      soilMoisture9To27cm: fData.hourly.soil_moisture_9_to_27cm?.[i] != null ? +(fData.hourly.soil_moisture_9_to_27cm[i] * 100).toFixed(1) : 37.0,
      et0: fData.hourly.et0_fao_evapotranspiration?.[i] ?? 0.2,
      solarRadiation: Math.round(fData.hourly.shortwave_radiation?.[i] ?? 200)
    });
  }

  const dailyTimes = fData.daily?.time || [];
  const daily16 = dailyTimes.map((date, idx) => ({
    date,
    weatherCode: fData.daily.weather_code?.[idx],
    tempMax: fData.daily.temperature_2m_max?.[idx],
    tempMin: fData.daily.temperature_2m_min?.[idx],
    sunrise: fData.daily.sunrise?.[idx],
    sunset: fData.daily.sunset?.[idx],
    uvIndexMax: fData.daily.uv_index_max?.[idx] ?? 0,
    precipitationSum: fData.daily.precipitation_sum?.[idx] ?? 0,
    precipitationProbabilityMax: fData.daily.precipitation_probability_max?.[idx] ?? 0,
    precipitationHours: fData.daily.precipitation_hours?.[idx] ?? 0,
    windSpeedMax: fData.daily.wind_speed_10m_max?.[idx] ?? 0,
    windGustsMax: fData.daily.wind_gusts_10m_max?.[idx] ?? 0,
    et0: fData.daily.et0_fao_evapotranspiration?.[idx] ?? 2.8,
    solarRadiationSum: fData.daily.shortwave_radiation_sum?.[idx] ?? 14.5
  }));

  const aqiVal = aData?.current?.us_aqi ?? 35;
  let aqiCat = { label: 'Tốt (Good)', color: '#34d399' };
  if (aqiVal > 150) aqiCat = { label: 'Xấu (Unhealthy)', color: '#ef4444' };
  else if (aqiVal > 100) aqiCat = { label: 'Kém (Sensitive)', color: '#f97316' };
  else if (aqiVal > 50) aqiCat = { label: 'Trung bình (Moderate)', color: '#f59e0b' };

  const currentTemp = fData.current?.temperature_2m ?? fData.current_weather?.temperature ?? 28;
  const currentHumidity = fData.current?.relative_humidity_2m ?? next24h[0]?.humidity ?? 68;
  const currentDewPoint = fData.current?.dew_point_2m ?? next24h[0]?.dewPoint ?? 22.5;
  const currentVpd = next24h[0]?.vpd ?? 0.85;
  const currentSoilT0 = next24h[0]?.soilTemperature0cm ?? currentTemp;
  const currentSoilT6 = next24h[0]?.soilTemperature6cm ?? +(currentTemp - 1.5).toFixed(1);
  const currentSoilM0_1 = next24h[0]?.soilMoisture0To1cm ?? 32.5;
  const currentSoilM1_3 = next24h[0]?.soilMoisture1To3cm ?? 34.0;
  const currentSoilM3_9 = next24h[0]?.soilMoisture3To9cm ?? 35.5;
  const currentSoilM9_27 = next24h[0]?.soilMoisture9To27cm ?? 37.0;

  const mushroomAgro = calculateMushroomAgroScores({
    temp: currentTemp,
    humidity: currentHumidity,
    dewPoint: currentDewPoint,
    vpd: currentVpd,
    soilMoist0_1: currentSoilM0_1,
    soilMoist1_3: currentSoilM1_3,
    soilTemp0: currentSoilT0,
    soilTemp6: currentSoilT6
  });

  const current = {
    ...(fData.current_weather || {}),
    temperature: currentTemp,
    cityName,
    apparentTemperature: fData.current?.apparent_temperature ?? next24h[0]?.apparentTemperature ?? currentTemp,
    humidity: currentHumidity,
    dewPoint: currentDewPoint,
    pressure: Math.round(fData.current?.surface_pressure ?? fData.hourly?.surface_pressure?.[startIndex] ?? 1013),
    uvIndex: next24h[0]?.uvIndex ?? 5,
    uvMax: daily16[0]?.uvIndexMax ?? 6,
    visibilityKm: fData.hourly?.visibility?.[startIndex] ? +(fData.hourly.visibility[startIndex] / 1000).toFixed(1) : 10,
    windspeed: fData.current?.wind_speed_10m ?? fData.current_weather?.windspeed ?? 10,
    winddirection: fData.current?.wind_direction_10m ?? fData.current_weather?.winddirection ?? 0,
    windGusts: daily16[0]?.windGustsMax ?? Math.round((fData.current?.wind_speed_10m || 10) * 1.3),
    precipitationSum: daily16[0]?.precipitationSum ?? 0,
    precipitationHours: daily16[0]?.precipitationHours ?? 0,
    precipitationProbabilityMax: daily16[0]?.precipitationProbabilityMax ?? 0,
    
    vpd: currentVpd,
    soilTemperature0cm: currentSoilT0,
    soilTemperature6cm: currentSoilT6,
    soilMoisture0To1cm: currentSoilM0_1,
    soilMoisture1To3cm: currentSoilM1_3,
    soilMoisture3To9cm: currentSoilM3_9,
    soilMoisture9To27cm: currentSoilM9_27,
    evapotranspiration: next24h[0]?.et0 ?? 0.25,
    solarRadiation: next24h[0]?.solarRadiation ?? 220,
    mushroomAgro,

    aqi: aqiVal,
    aqiCategory: aqiCat,
    pm25: aData?.current?.pm2_5 ? +aData.current.pm2_5.toFixed(1) : 12.5,
    pm10: aData?.current?.pm10 ? +aData.current.pm10.toFixed(1) : 22.0,
    ozone: aData?.current?.ozone ? +aData.current.ozone.toFixed(1) : 38.0,
    no2: aData?.current?.nitrogen_dioxide ? +aData.current.nitrogen_dioxide.toFixed(1) : 16.0,
    co: aData?.current?.carbon_monoxide ? +aData.current.carbon_monoxide.toFixed(1) : 240.0
  };

  return {
    city: cityName,
    latitude: lat,
    longitude: lon,
    timezone: fData.timezone,
    current,
    mushroomAgro,
    hourly24: next24h,
    daily16,
    forecastDaysCount: daily16.length,
    maxDaysSupported: 16
  };
}

/**
 * 5. HỆ THỐNG & CHROMA VECTOR AI
 */
export async function fetchSystemStatus() {
  const res = await fetch('/api/system/status');
  if (!res.ok) throw new Error('Không thể tải trạng thái hệ thống');
  return await res.json();
}

export async function fetchHistoricalComparison(lat, lon, currentCity = '') {
  if (!lat || !lon) return null;
  const res = await fetch(`/api/weather/compare-history?lat=${lat}&lon=${lon}&city=${encodeURIComponent(currentCity)}`);
  if (!res.ok) throw new Error('Không thể tải dữ liệu so sánh lịch sử');
  return await res.json();
}

export async function triggerAdminCleanup() {
  const res = await fetch('/api/admin/cleanup', { method: 'POST' });
  if (!res.ok) throw new Error('Lỗi khi thực hiện dọn dẹp hệ thống');
  return await res.json();
}

export async function fetchChromaStatus() {
  const res = await fetch('/api/chroma/status');
  if (!res.ok) throw new Error('Không thể tải trạng thái ChromaDB');
  return await res.json();
}

export async function syncChromaDatabase() {
  const res = await fetch('/api/chroma/sync', { method: 'POST' });
  if (!res.ok) throw new Error('Đồng bộ ChromaDB thất bại');
  return await res.json();
}

export async function queryChromaVector(prompt, limit = 6) {
  const res = await fetch('/api/chroma/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: prompt, limit })
  });
  if (!res.ok) throw new Error('Không thể truy vấn ChromaDB');
  return await res.json();
}

