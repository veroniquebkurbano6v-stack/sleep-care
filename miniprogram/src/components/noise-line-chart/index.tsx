/**
 * 噪音折线图组件（兼容微信小程序）
 * 使用 Taro Canvas API 绘制平滑曲线 + 面积填充
 * @author Developer
 * @created 2026-06-23
 */

import React, { useEffect } from 'react';
import { Canvas } from '@tarojs/components';
import Taro from '@tarojs/taro';

interface NoiseLineChartProps {
  /** 噪音数据点数组（单位：dB） */
  noise: number[];
  /** 容器宽度 */
  width?: number;
  /** 容器高度 */
  height?: number;
}

/** 画布ID */
const CANVAS_ID = 'noiseLineChart';

const NoiseLineChart: React.FC<NoiseLineChartProps> = ({ noise, width = 340, height = 200 }) => {
  useEffect(() => {
    if (!noise || noise.length === 0) return;

    const timer = setTimeout(() => {
      drawChart();
    }, 100);

    return () => clearTimeout(timer);
  }, [noise]);

  /** 绘制图表 */
  const drawChart = () => {
    try {
      const ctx = Taro.createCanvasContext(CANVAS_ID);
      if (!ctx) return;

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
      const toX = (i: number) => padding.left + (i / Math.max(noise.length - 1, 1)) * chartW;

      // 标题
      ctx.setFillStyle('#333');
      ctx.setFontSize(12);
      ctx.setTextAlign('center');
      ctx.fillText('Noise Level', width / 2, 18);

      // Y轴刻度
      ctx.setStrokeStyle('#e8e8e8');
      ctx.setLineWidth(0.5);
      ctx.setFillStyle('#999');
      ctx.setFontSize(9);
      ctx.setTextAlign('right');

      for (let i = 0; i <= 4; i++) {
        const val = minVal + (range / 4) * i;
        const y = toY(val);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartW, y);
        ctx.stroke();
        ctx.fillText(`${Math.round(val)}dB`, padding.left - 4, y + 3);
      }

      // 面积填充
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(noise[0]));
      for (let i = 1; i < noise.length; i++) {
        const x0 = toX(i - 1);
        const y0 = toY(noise[i - 1]);
        const x1 = toX(i);
        const y1 = toY(noise[i]);
        const cpx = (x0 + x1) / 2;
        if (i === 1) ctx.lineTo(x0, y0);
        ctx.quadraticCurveTo(x0, y0, cpx, (y0 + y1) / 2);
        if (i === noise.length - 1) {
          ctx.quadraticCurveTo(cpx, (y0 + y1) / 2, x1, y1);
        }
      }
      ctx.lineTo(toX(noise.length - 1), padding.top + chartH);
      ctx.lineTo(toX(0), padding.top + chartH);
      ctx.closePath();
      ctx.setFillStyle('rgba(74, 108, 247, 0.15)');
      ctx.fill();

      // 平滑曲线
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(noise[0]));
      for (let i = 1; i < noise.length; i++) {
        const x0 = toX(i - 1);
        const y0 = toY(noise[i - 1]);
        const x1 = toX(i);
        const y1 = toY(noise[i]);
        const cpx = (x0 + x1) / 2;
        if (i === 1) ctx.lineTo(x0, y0);
        ctx.quadraticCurveTo(x0, y0, cpx, (y0 + y1) / 2);
        if (i === noise.length - 1) {
          ctx.quadraticCurveTo(cpx, (y0 + y1) / 2, x1, y1);
        }
      }
      ctx.setStrokeStyle('#4a6cf7');
      ctx.setLineWidth(2);
      ctx.stroke();

      // X轴刻度
      ctx.setFillStyle('#999');
      ctx.setFontSize(9);
      ctx.setTextAlign('center');
      for (let i = 0; i <= 24; i += 6) {
        const idx = i * 6;
        if (idx < noise.length) {
          ctx.fillText(`${String(i).padStart(2, '0')}:00`, toX(idx), height - 10);
        }
      }

      // 夜间区域背景标记（22:00-06:00）
      const nightStartIdx = 22 * 6;
      const nightEndIdx = 30 * 6;
      if (nightStartIdx < noise.length) {
        const endX = Math.min(toX(Math.min(nightEndIdx, noise.length - 1)), padding.left + chartW);
        ctx.setFillStyle('rgba(100, 120, 200, 0.08)');
        ctx.fillRect(toX(nightStartIdx), padding.top, endX - toX(nightStartIdx), chartH);
      }

      ctx.draw(false);
    } catch (err) {
      console.error('[NoiseLineChart] draw error:', err);
    }
  };

  return (
    <Canvas
      canvasId={CANVAS_ID}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
};

export default NoiseLineChart;
