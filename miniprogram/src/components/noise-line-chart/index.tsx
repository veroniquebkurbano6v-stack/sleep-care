/**
 * 噪音折线图组件（纯 Canvas 绘制）
 * 平滑曲线 + 面积填充 + dB 单位
 * 不依赖 echarts，兼容 Taro H5 / 微信小程序
 * @author Developer
 * @created 2026-06-23
 */

import { useEffect, useRef } from 'react';

interface NoiseLineChartProps {
  /** 噪音数据点数组（单位：dB） */
  noise: number[];
  /** 容器宽度 */
  width?: number;
  /** 容器高度 */
  height?: number;
}

const NoiseLineChart: React.FC<NoiseLineChartProps> = ({ noise, width = 340, height = 200 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !noise || noise.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 高清适配
    const dpr = window.devicePixelRatio || 2;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 布局参数
    const padding = { top: 28, bottom: 32, left: 36, right: 12 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // 数据范围
    const minVal = Math.min(...noise) - 2;
    const maxVal = Math.max(...noise) + 2;
    const range = Math.max(maxVal - minVal, 1);

    /** 数据值 → Y坐标 */
    const toY = (val: number) => padding.top + chartH - ((val - minVal) / range) * chartH;

    /** 索引 → X坐标 */
    const toX = (i: number) => padding.left + (i / (noise.length - 1)) * chartW;

    // 标题
    ctx.fillStyle = '#333';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Noise Level', width / 2, 18);

    // Y轴刻度（3条网格线）
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#999';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
      const val = minVal + (range / 4) * i;
      const y = toY(val);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
      ctx.fillText(`${Math.round(val)}dB`, padding.left - 4, y + 3);
    }

    // 绘制面积填充（渐变）
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, 'rgba(74, 108, 247, 0.35)');
    gradient.addColorStop(1, 'rgba(74, 108, 247, 0.03)');

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(noise[0]));
    for (let i = 1; i < noise.length; i++) {
      // 贝塞尔曲线平滑：使用前一个点和当前点的中点作为控制点
      const x0 = toX(i - 1);
      const y0 = toY(noise[i - 1]);
      const x1 = toX(i);
      const y1 = toY(noise[i]);
      const cpx = (x0 + x1) / 2;
      if (i === 1) {
        ctx.lineTo(x0, y0);
      }
      ctx.quadraticCurveTo(x0, y0, cpx, (y0 + y1) / 2);
      if (i === noise.length - 1) {
        ctx.quadraticCurveTo(cpx, (y0 + y1) / 2, x1, y1);
      }
    }
    ctx.lineTo(toX(noise.length - 1), padding.top + chartH);
    ctx.lineTo(toX(0), padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 绘制平滑曲线（线条）
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(noise[0]));
    for (let i = 1; i < noise.length; i++) {
      const x0 = toX(i - 1);
      const y0 = toY(noise[i - 1]);
      const x1 = toX(i);
      const y1 = toY(noise[i]);
      const cpx = (x0 + x1) / 2;
      ctx.quadraticCurveTo(x0, y0, cpx, (y0 + y1) / 2);
      if (i === noise.length - 1) {
        ctx.quadraticCurveTo(cpx, (y0 + y1) / 2, x1, y1);
      }
    }
    ctx.strokeStyle = '#4a6cf7';
    ctx.lineWidth = 2;
    ctx.stroke();

    // X轴刻度（每6小时显示一次，144/6=24小时，每6小时=36个点）
    ctx.fillStyle = '#999';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 24; i += 6) {
      const idx = i * 6; // 每小时6个点
      if (idx < noise.length) {
        const x = toX(idx);
        ctx.fillText(`${String(i).padStart(2, '0')}:00`, x, height - 10);
      }
    }

    // 绘制夜间区域背景标记（22:00-06:00）
    const nightStartIdx = 22 * 6; // 22:00
    const nightEndIdx = 30 * 6;   // 06:00 (次日)
    if (nightStartIdx < noise.length) {
      const endX = Math.min(toX(Math.min(nightEndIdx, noise.length - 1)), padding.left + chartW);
      ctx.fillStyle = 'rgba(100, 120, 200, 0.08)';
      ctx.fillRect(toX(nightStartIdx), padding.top, endX - toX(nightStartIdx), chartH);
    }
  }, [noise, width, height]);

  return (
    <canvas
      ref={canvasRef}
      type="2d"
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
};

export default NoiseLineChart;
