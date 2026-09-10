import React, { useEffect, useRef } from 'react';

/**
 * WeatherCanvas: 60fps Dynamic Atmospheric Renderer
 * Automatically adapts to real-time Open-Meteo WMO weather code & solar position (is_day).
 * Completely live with zero manual simulation controls.
 */
export default function WeatherCanvas({ weatherCode = 0, isDay = 1 }) {
  const canvasRef = useRef(null);

  // Map WMO Weather Codes dynamically
  const getMode = () => {
    if (weatherCode >= 95) return 'thunderstorm';
    if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) return 'snow';
    if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) return 'rain';
    if (weatherCode === 45 || weatherCode === 48) return 'fog';
    if (weatherCode === 3) return 'cloudy';
    if (isDay === 0) return 'night';
    return 'sunny';
  };

  const mode = getMode();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Stars
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * width,
      y: Math.random() * (height * 0.75),
      radius: Math.random() * 1.4 + 0.4,
      alpha: Math.random(),
      speed: Math.random() * 0.015 + 0.005
    }));

    // Raindrops
    const raindrops = Array.from({ length: mode === 'thunderstorm' ? 220 : 120 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: Math.random() * 18 + 12,
      speed: Math.random() * 10 + 10,
      opacity: Math.random() * 0.35 + 0.25,
      thickness: Math.random() * 1.3 + 0.7
    }));

    const splashes = [];

    // Snowflakes
    const snowflakes = Array.from({ length: 80 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2.8 + 1.2,
      speed: Math.random() * 1.1 + 0.5,
      wind: Math.random() * 0.7 - 0.35,
      oscillation: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.6 + 0.3
    }));

    // Clouds
    const clouds = Array.from({ length: 10 }, () => ({
      x: Math.random() * width,
      y: Math.random() * (height * 0.45) + 40,
      radius: Math.random() * 110 + 80,
      speed: (Math.random() * 0.15 + 0.06) * (Math.random() > 0.5 ? 1 : -1),
      opacity: Math.random() * 0.1 + 0.04
    }));

    let lightningOpacity = 0;
    let nextLightning = Date.now() + Math.random() * 5000 + 2500;
    let lightningBranches = [];
    let sunRotation = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // SUNNY / CLEAR DAY
      if (mode === 'sunny') {
        sunRotation += 0.0015;
        const sunX = width * 0.85;
        const sunY = height * 0.2;

        const sunGlow = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 300);
        sunGlow.addColorStop(0, 'rgba(253, 224, 71, 0.28)');
        sunGlow.addColorStop(0.35, 'rgba(245, 158, 11, 0.1)');
        sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(sunX, sunY);
        ctx.rotate(sunRotation);
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.08)';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 12; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos((i * Math.PI) / 6) * 200, Math.sin((i * Math.PI) / 6) * 200);
          ctx.stroke();
        }
        ctx.restore();

        ctx.beginPath();
        ctx.arc(sunX, sunY, 42, 0, Math.PI * 2);
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 35;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // NIGHT
      else if (mode === 'night') {
        const moonX = width * 0.85;
        const moonY = height * 0.2;

        const moonGlow = ctx.createRadialGradient(moonX, moonY, 15, moonX, moonY, 180);
        moonGlow.addColorStop(0, 'rgba(226, 232, 240, 0.2)');
        moonGlow.addColorStop(0.5, 'rgba(148, 163, 184, 0.05)');
        moonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = moonGlow;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.beginPath();
        ctx.arc(moonX, moonY, 32, 0, Math.PI * 2);
        ctx.fillStyle = '#f8fafc';
        ctx.shadowColor = '#94a3b8';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(moonX - 10, moonY - 5, 28, 0, Math.PI * 2);
        ctx.fillStyle = '#030712';
        ctx.fill();
        ctx.restore();

        stars.forEach((star) => {
          star.alpha += star.speed;
          const currentAlpha = Math.abs(Math.sin(star.alpha));
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha * 0.8})`;
          ctx.fill();
        });
      }

      // RAIN & THUNDERSTORM
      if (mode === 'rain' || mode === 'thunderstorm') {
        ctx.strokeStyle = mode === 'thunderstorm' ? 'rgba(186, 230, 253, 0.65)' : 'rgba(56, 189, 248, 0.45)';
        raindrops.forEach((drop) => {
          ctx.lineWidth = drop.thickness;
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - 2, drop.y + drop.length);
          ctx.stroke();

          drop.y += drop.speed;
          drop.x -= 1;

          if (drop.y > height - 25) {
            if (Math.random() > 0.65) {
              splashes.push({
                x: drop.x,
                y: height - 15 + Math.random() * 8,
                radius: 1,
                opacity: 0.5
              });
            }
            drop.y = -drop.length;
            drop.x = Math.random() * (width + 50);
          }
        });

        for (let i = splashes.length - 1; i >= 0; i--) {
          const sp = splashes[i];
          ctx.beginPath();
          ctx.ellipse(sp.x, sp.y, sp.radius * 2, sp.radius, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${sp.opacity})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          sp.radius += 0.35;
          sp.opacity -= 0.04;
          if (sp.opacity <= 0) splashes.splice(i, 1);
        }

        if (mode === 'thunderstorm') {
          const now = Date.now();
          if (now > nextLightning) {
            lightningOpacity = 0.8;
            nextLightning = now + Math.random() * 6000 + 3500;

            lightningBranches = [];
            let lx = width * (0.3 + Math.random() * 0.4);
            let ly = 0;
            lightningBranches.push({ x: lx, y: ly });
            while (ly < height * 0.6) {
              lx += (Math.random() - 0.5) * 40;
              ly += Math.random() * 30 + 15;
              lightningBranches.push({ x: lx, y: ly });
            }
          }

          if (lightningOpacity > 0.02) {
            ctx.fillStyle = `rgba(224, 242, 254, ${lightningOpacity * 0.3})`;
            ctx.fillRect(0, 0, width, height);

            if (lightningBranches.length > 1) {
              ctx.beginPath();
              ctx.moveTo(lightningBranches[0].x, lightningBranches[0].y);
              for (let b = 1; b < lightningBranches.length; b++) {
                ctx.lineTo(lightningBranches[b].x, lightningBranches[b].y);
              }
              ctx.strokeStyle = `rgba(255, 255, 255, ${lightningOpacity})`;
              ctx.lineWidth = 2.5;
              ctx.stroke();
            }

            lightningOpacity *= 0.85;
          }
        }
      }

      // SNOW
      if (mode === 'snow') {
        snowflakes.forEach((flake) => {
          flake.oscillation += 0.02;
          flake.y += flake.speed;
          flake.x += Math.sin(flake.oscillation) * 0.8 + flake.wind;

          if (flake.y > height) {
            flake.y = -10;
            flake.x = Math.random() * width;
          }

          ctx.beginPath();
          ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
          ctx.fill();
        });
      }

      // FOG / CLOUDY
      if (mode === 'fog' || mode === 'cloudy') {
        clouds.forEach((c) => {
          c.x += c.speed;
          if (c.x - c.radius > width) c.x = -c.radius;
          if (c.x + c.radius < 0) c.x = width + c.radius;

          const grad = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, c.radius);
          grad.addColorStop(0, `rgba(148, 163, 184, ${c.opacity})`);
          grad.addColorStop(1, 'rgba(3, 7, 18, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [mode, weatherCode, isDay]);

  return (
    <div className="weather-canvas-container">
      <canvas ref={canvasRef} className="weather-canvas" />
    </div>
  );
}
