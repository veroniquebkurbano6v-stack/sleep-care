/**
 * 睡眠分期柱状图组件（纯 Canvas 绘制）
 * 不依赖 echarts，兼容 Taro H5 / 微信小程序
 * @author Developer
 * @created 2026-06-23
 */

import { useEffect, useRef } from 'react';

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

const StageBarChart: React.FC<StageBarChartProps> = ({ stages, width = 340, height = 260 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stages || stages.length === 0) return;

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
    const padding = { top: 36, bottom: 24, left: 8, right: 8 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const barCount = stages.length;
    const gap = 2;
    const barW = Math.max(2, (chartW - gap * (barCount + 1)) / barCount);

    // 标题
    ctx.fillStyle = '#333';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sleep Stages', width / 2, 20);

    // 绘制柱子
    stages.forEach((stage, i) => {
      const x = padding.left + gap + i * (barW + gap);
      const color = STAGE_COLORS[stage] || '#ccc';
      ctx.fillStyle = color;
      ctx.fillRect(x, padding.top, barW, chartH);
    });

    // 底部刻度（每12个点显示一次 = 每2小时）
    ctx.fillStyle = '#999';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < barCount; i += 12) {
      const hour = 22 + Math.floor(i / 6);
      const displayHour = hour >= 24 ? hour - 24 : hour;
      const x = padding.left + gap + i * (barW + gap) + barW / 2;
      ctx.fillText(`${String(displayHour).padStart(2, '0')}:00`, x, height - 6);
    }
  }, [stages, width, height]);

  return (
    <canvas
      ref={canvasRef}
      type="2d"
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
};

export default StageBarChart;
