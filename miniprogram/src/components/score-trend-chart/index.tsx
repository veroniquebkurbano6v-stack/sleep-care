/**
 * 睡眠评分趋势图组件（兼容微信小程序）
 * 使用 Taro Canvas API 绘制折线图，包含 markLine 平均分参考线
 * @author Developer
 * @created 2026-06-23
 */

import React, { useEffect } from 'react';
import { Canvas } from '@tarojs/components';
import Taro from '@tarojs/taro';

interface ScoreTrendChartProps {
  /** 日期标签 */
  labels: string[];
  /** 评分数组 */
  scores: number[];
  /** 平均分 */
  avgScore: number;
  /** 容器宽度 */
  width?: number;
  /** 容器高度 */
  height?: number;
}

/** 画布ID */
const CANVAS_ID = 'scoreTrendChart';

const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({
  labels,
  scores,
  avgScore,
  width = 340,
  height = 200,
}) => {
  useEffect(() => {
    if (!labels.length || !scores.length) return;

    // 延迟等待 DOM 渲染完成
    const timer = setTimeout(() => {
      drawChart();
    }, 100);

    return () => clearTimeout(timer);
  }, [labels, scores, avgScore]);

  /** 绘制图表 */
  const drawChart = () => {
    try {
      const ctx = Taro.createCanvasContext(CANVAS_ID);
      if (!ctx) return;

      const dpr = Taro.getSystemInfoSync().pixelRatio || 2;
      const canvasWidth = width * dpr;
      const canvasHeight = height * dpr;

      // 布局参数
      const padding = { top: 32, bottom: 28, left: 40, right: 16 };
      const chartW = width - padding.left - padding.right;
      const chartH = height - padding.top - padding.bottom;

      // Y轴范围固定 40-100
      const yMin = 40;
      const yMax = 100;
      const yRange = yMax - yMin;

      /** 分数值 → Y坐标 */
      const toY = (val: number) => padding.top + chartH - ((val - yMin) / yRange) * chartH;

      /** 索引 → X坐标 */
      const toX = (i: number) => padding.left + (i / Math.max(scores.length - 1, 1)) * chartW;

      // 标题
      ctx.setFillStyle('#333');
      ctx.setFontSize(12);
      ctx.setTextAlign('center');
      ctx.fillText('睡眠评分趋势', width / 2, 18);

      // Y轴刻度线和标签
      ctx.setStrokeStyle('#e8e8e8');
      ctx.setLineWidth(0.5);
      ctx.setFillStyle('#999');
      ctx.setFontSize(9);
      ctx.setTextAlign('right');

      for (let i = 0; i <= 6; i++) {
        const val = yMin + (yRange / 6) * i;
        const y = toY(val);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartW, y);
        ctx.stroke();
        ctx.fillText(`${Math.round(val)}`, padding.left - 4, y + 3);
      }

      // X轴标签
      ctx.setFillStyle('#999');
      ctx.setFontSize(9);
      ctx.setTextAlign('center');
      const step = Math.max(1, Math.floor(labels.length / 7));
      labels.forEach((label, i) => {
        if (i % step === 0) {
          ctx.fillText(label, toX(i), height - 8);
        }
      });

      // 绘制面积填充（渐变效果用半透明色模拟）
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(scores[0]));
      for (let i = 1; i < scores.length; i++) {
        const x0 = toX(i - 1);
        const y0 = toY(scores[i - 1]);
        const x1 = toX(i);
        const y1 = toY(scores[i]);
        const cpx = (x0 + x1) / 2;
        if (i === 1) ctx.lineTo(x0, y0);
        ctx.quadraticCurveTo(x0, y0, cpx, (y0 + y1) / 2);
        if (i === scores.length - 1) {
          ctx.quadraticCurveTo(cpx, (y0 + y1) / 2, x1, y1);
        }
      }
      ctx.lineTo(toX(scores.length - 1), padding.top + chartH);
      ctx.lineTo(toX(0), padding.top + chartH);
      ctx.closePath();
      ctx.setFillStyle('rgba(74, 108, 247, 0.15)');
      ctx.fill();

      // 绘制平滑曲线
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(scores[0]));
      for (let i = 1; i < scores.length; i++) {
        const x0 = toX(i - 1);
        const y0 = toY(scores[i - 1]);
        const x1 = toX(i);
        const y1 = toY(scores[i]);
        const cpx = (x0 + x1) / 2;
        if (i === 1) ctx.lineTo(x0, y0);
        ctx.quadraticCurveTo(x0, y0, cpx, (y0 + y1) / 2);
        if (i === scores.length - 1) {
          ctx.quadraticCurveTo(cpx, (y0 + y1) / 2, x1, y1);
        }
      }
      ctx.setStrokeStyle('#4a6cf7');
      ctx.setLineWidth(2);
      ctx.stroke();

      // 绘制数据点标记（circle）
      scores.forEach((score, i) => {
        const x = toX(i);
        const y = toY(score);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.setFillStyle('#4a6cf7');
        ctx.fill();
        ctx.setStrokeStyle('#ffffff');
        ctx.setLineWidth(1);
        ctx.stroke();
      });

      // markLine 平均分参考线（红色虚线）
      const avgY = toY(avgScore);
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, avgY);
      ctx.lineTo(padding.left + chartW, avgY);
      ctx.setStrokeStyle('#ff6b6b');
      ctx.setLineWidth(1.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // markLine 标签
      ctx.setFillStyle('#ff6b6b');
      ctx.setFontSize(10);
      ctx.setTextAlign('left');
      ctx.fillText(`平均 ${avgScore} 分`, padding.left + chartW - 75, avgY - 4);

      ctx.draw(false);
    } catch (err) {
      console.error('[ScoreTrendChart] draw error:', err);
    }
  };

  return (
    <Canvas
      canvasId={CANVAS_ID}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
};

export default ScoreTrendChart;
