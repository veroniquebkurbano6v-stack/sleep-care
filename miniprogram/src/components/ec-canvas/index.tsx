/**
 * ECharts Canvas 组件（Taro/微信小程序版）
 * 封装 ECharts 渲染逻辑，支持柱状图、折线图等
 * @author Developer
 * @created 2026-06-23
 */

import Taro from '@tarojs/taro';
import * as echarts from './echarts.simple';
import { useEffect, useRef } from 'react';

interface EcCanvasProps {
  /** ECharts 配置项 */
  option: echarts.EChartsOption;
  /** 容器宽度 */
  width?: number;
  /** 容器高度 */
  height?: number;
}

const EcCanvas: React.FC<EcCanvasProps> = ({ option, width = 350, height = 300 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  /** 初始化或更新图表 */
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    // 获取设备像素比，保证高清显示
    const dpr = Taro.getSystemInfoSync().pixelRatio || 2;

    if (!chartRef.current) {
      // 首次初始化
      chartRef.current = echarts.init(canvas, null, {
        width,
        height,
        devicePixelRatio: dpr,
      });
    }

    // 设置配置并渲染
    chartRef.current.setOption(option, true);

    return () => {
      // 组件卸载时释放资源
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, [option, width, height]);

  return (
    <canvas
      ref={canvasRef}
      canvasId={`ec-canvas-${Math.random().toString(36).slice(2, 9)}`}
      type="2d"
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
};

export default EcCanvas;
