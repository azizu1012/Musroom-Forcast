import React from 'react';
import { 
  Sun, 
  Moon, 
  Cloud, 
  CloudSun, 
  CloudMoon, 
  CloudRain, 
  CloudDrizzle, 
  CloudLightning, 
  Snowflake, 
  CloudFog, 
  Wind 
} from 'lucide-react';

/**
 * Maps Open-Meteo WMO weather codes to metadata
 */
export function getWeatherMeta(code, isDay = 1) {
  switch (code) {
    case 0:
      return {
        label: isDay ? 'Trời Quang Đãng' : 'Đêm Quang Đãng',
        icon: isDay ? <Sun size={36} color="#fbbf24" /> : <Moon size={36} color="#e2e8f0" />,
        color: isDay ? '#f59e0b' : '#94a3b8'
      };
    case 1:
      return {
        label: isDay ? 'Nắng Nhẹ' : 'Ít Mây Ban Đêm',
        icon: isDay ? <CloudSun size={36} color="#f59e0b" /> : <CloudMoon size={36} color="#cbd5e1" />,
        color: '#38bdf8'
      };
    case 2:
      return {
        label: 'Mây Rải Rác',
        icon: isDay ? <CloudSun size={36} color="#38bdf8" /> : <CloudMoon size={36} color="#94a3b8" />,
        color: '#38bdf8'
      };
    case 3:
      return {
        label: 'Trời U Ám / Nhiều Mây',
        icon: <Cloud size={36} color="#94a3b8" />,
        color: '#64748b'
      };
    case 45:
    case 48:
      return {
        label: 'Sương Mù Dày',
        icon: <CloudFog size={36} color="#cbd5e1" />,
        color: '#94a3b8'
      };
    case 51:
    case 53:
    case 55:
      return {
        label: 'Mưa Phùn Rải Rác',
        icon: <CloudDrizzle size={36} color="#38bdf8" />,
        color: '#38bdf8'
      };
    case 61:
    case 63:
    case 65:
      return {
        label: 'Mưa Rào',
        icon: <CloudRain size={36} color="#0284c7" />,
        color: '#0284c7'
      };
    case 71:
    case 73:
    case 75:
    case 77:
      return {
        label: 'Tuyết Rơi',
        icon: <Snowflake size={36} color="#bae6fd" />,
        color: '#38bdf8'
      };
    case 80:
    case 81:
    case 82:
      return {
        label: 'Mưa Lớn Từng Đợt',
        icon: <CloudRain size={36} color="#0369a1" />,
        color: '#0284c7'
      };
    case 85:
    case 86:
      return {
        label: 'Bão Tuyết',
        icon: <Snowflake size={36} color="#ffffff" />,
        color: '#93c5fd'
      };
    case 95:
    case 96:
    case 99:
      return {
        label: 'Dông Bão Sấm Sét',
        icon: <CloudLightning size={36} color="#a855f7" />,
        color: '#8b5cf6'
      };
    default:
      return {
        label: 'Thời Tiết Bình Thường',
        icon: <Sun size={36} color="#fbbf24" />,
        color: '#f59e0b'
      };
  }
}
