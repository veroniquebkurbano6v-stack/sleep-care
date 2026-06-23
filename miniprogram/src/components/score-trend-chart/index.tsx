/**
 * 睡眠评分趋势图组件（使用 ECharts）
 * 展示日/周/月视图的评分趋势，包含 markLine 平均分参考线
 * @author Developer
 * @created 2026-06-23
 */

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

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

const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({
  labels,
  scores,
  avgScore,
  width = 340,
  height = 200,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !labels.length || !scores.length) return;

    // 初始化 ECharts 实例
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // 配置项
    const option = {
      grid: {
        top: 30,
        bottom: 30,
        left: 40,
        right: 20,
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          fontSize: 10,
          color: '#666',
        },
        axisLine: {
          lineStyle: {
            color: '#ddd',
          },
        },
      },
      yAxis: {
        type: 'value',
        min: 40,
        max: 100,
        axisLabel: {
          fontSize: 10,
          color: '#666',
        },
        axisLine: {
          lineStyle: {
            color: '#ddd',
          },
        },
        splitLine: {
          lineStyle: {
            color: '#eee',
          },
        },
      },
      series: [
        {
          type: 'line',
          data: scores,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            color: '#4a6cf7',
            width: 2,
          },
          itemStyle: {
            color: '#4a6cf7',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(74, 108, 247, 0.3)' },
                { offset: 1, color: 'rgba(74, 108, 247, 0.05)' },
              ],
            },
          },
        },
      ],
      // markLine 平均分参考线
      series: [
        {
          type: 'line',
          data: scores,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            color: '#4a6cf7',
            width: 2,
          },
          itemStyle: {
            color: '#4a6cf7',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(74, 108, 247, 0.3)' },
                { offset: 1, color: 'rgba(74, 108, 247, 0.05)' },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            label: {
              position: 'end',
              formatter: `平均 ${avgScore} 分`,
              fontSize: 10,
              color: '#ff6b6b',
            },
            lineStyle: {
              color: '#ff6b6b',
              width: 2,
              type: 'dashed',
            },
            data: [
              {
                yAxis: avgScore,
              },
            ],
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    // 响应式调整
    const resizeObserver = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [labels, scores, avgScore, width, height]);

  return (
    <div
      ref={chartRef}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
};

export default ScoreTrendChart;