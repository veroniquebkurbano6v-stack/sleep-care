/**
 * 睡眠分期柱状图组件（兼容微信小程序）
 * 使用 Taro Canvas API 绘制
 * @author Developer
 * @created 2026-06-23
 */

import React, { useEffect } from 'react';
import { Canvas } from '@tarojs/components';
import Taro from '@tarojs/taro';

interface StageBarChartProps {
  /** 48个分期数据点：0=清醒, 1=浅睡, 2=深睡, 3=REM */
  stages: number[];
  /** 容器宽度 */
  width?: number;
  /** 容器高度 */
  height?: number;
}

/** 分期颜色 */
const STAGE_COLORS: Record<number, string> = {
  0: '#ff6b6b',
  1: '#ffd93d',
  2: '#4dabf7',
  3: '#da77f2',
};

/** 画布ID */
const CANVAS_ID = 'stageBarChart';

const StageBarChart: React.FC<StageBarChartProps> = ({ stages, width = 340, height = 260 }) => {
  useEffect(() => {
    if (!stages || stages.length === 0) return;

    const timer = setTimeout(() => {
      drawChart();
    }, 100);

    return () => clearTimeout(timer);
  }, [stages]);

  /** 绘制图表 */
  const drawChart = () => {
    try {
      const ctx = Taro.createCanvasContext(CANVAS_ID);
      if (!ctx) return;

      // 布局参数
      const padding = { top: 36, bottom: 24, left: 8, right: 8 };
      const chartW = width - padding.left - padding.right;
      const chartH = height - padding.top - padding.bottom;
      const barCount = stages.length;
      const gap = 1;
      const barW = Math.max(1, (chartW - gap * (barCount + 1)) / barCount);

      // 标题
      ctx.setFillStyle('#333');
      ctx.setFontSize(12);
      ctx.setTextAlign('center');
      ctx.fillText('Sleep Stages', width / 2, 20);

      // 绘制柱子
      stages.forEach((stage, i) => {
        const x = padding.left + gap + i * (barW + gap);
        const color = STAGE_COLORS[stage] || '#ccc';
        ctx.setFillStyle(color);
        ctx.fillRect(x, padding.top, barW, chartH);
      });

      // 底部刻度（每12个点显示一次 = 每2小时）
      ctx.setFillStyle('#999');
      ctx.setFontSize(9);
      ctx.setTextAlign('center');
      for (let i = 0; i < barCount; i += 12) {
        const hour = 22 + Math.floor(i / 6);
        const displayHour = hour >= 24 ? hour - 24 : hour;
        const x = padding.left + gap + i * (barW + gap) + barW / 2;
        ctx.fillText(`${String(displayHour).padStart(2, '0')}:00`, x, height - 6);
      }

      ctx.draw(false);
    } catch (err) {
      console.error('[StageBarChart] draw error:', err);
    }
  };

  return (
    <Canvas
      canvasId={CANVAS_ID}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
};

export default StageBarChart;
