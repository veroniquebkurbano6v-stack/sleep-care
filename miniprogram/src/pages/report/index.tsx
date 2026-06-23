/**
 * 睡眠分期报告页
 * 展示睡眠分期柱状图（ECharts），支持日期切换
 * @author Developer
 * @created 2026-06-23
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Picker } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import EcCanvas from '@/components/ec-canvas/index';
import { request } from '@/services/api';
import { isLoggedIn } from '@/utils/auth';
import * as echarts from '@/components/ec-canvas/echarts.simple';
import styles from './index.module.scss';

/** 分期数据响应类型 */
interface StagesResponse {
  date: string;
  total_points: number;
  stages: number[];
  encoding: string;
}

/** 分期颜色映射 */
const STAGE_COLORS: Record<number, string> = {
  0: '#ff6b6b', // 清醒 - 红色
  1: '#ffd93d', // 浅睡 - 黄色
  2: '#4dabf7', // 深睡 - 蓝色
  3: '#da77f2', // REM - 紫色
};

const STAGE_LABELS: Record<number, string> = {
  0: '清醒',
  1: '浅睡',
  2: '深睡',
  3: 'REM',
};

/** 获取今天及前6天的日期列表 */
function getDateOptions(): string[] {
  const options: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    options.push(d.toISOString().slice(0, 10));
  }
  return options;
}

const ReportPage = () => {
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [stagesData, setStagesData] = useState<StagesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  /** 获取分期数据 */
  const fetchStages = async (date: string) => {
    setLoading(true);
    try {
      const data = await request<StagesResponse>('GET', `/api/sleep/stages?date=${date}`);
      setStagesData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败';
      console.error('[Report]', msg);
      Taro.showToast({ title: msg, icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    if (!isLoggedIn()) {
      Taro.redirectTo({ url: '/pages/login/index' });
      return;
    }
    fetchStages(selectedDate);
  });

  useEffect(() => {
    if (!isLoggedIn()) return;
    fetchStages(selectedDate);
  }, [selectedDate]);

  /** 构建ECharts柱状图配置 */
  const getChartOption = (): echarts.EChartsOption => {
    if (!stagesData || !stagesData.stages || stagesData.stages.length === 0) {
      return {};
    }

    const stages = stagesData.stages;

    // 将48个数据点转为柱状图数据（每个柱子一个颜色）
    const barData = stages.map((stage) => ({
      value: 1,
      itemStyle: { color: STAGE_COLORS[stage] || '#ccc' },
    }));

    // X轴标签：每4个点显示一个时间（每40分钟）
    const xLabels: string[] = [];
    for (let i = 0; i < stages.length; i += 4) {
      const hour = Math.floor(i / 6); // 每6个点=1小时
      const min = ((i % 6) * 10);
      xLabels.push(`${String(22 + Math.floor((hour + min / 60)) % 24).padStart(2, '0')}:${String(((hour * 60 + min) % 60)).padStart(2, '0')}`);
    }

    return {
      title: {
        text: `睡眠分期图 - ${selectedDate}`,
        left: 'center',
        textStyle: { fontSize: 14, color: '#333' },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const idx = params[0]?.dataIndex ?? 0;
          const stageVal = stages[idx];
          return `${STAGE_LABELS[stageVal] ?? '未知'} (时段 ${idx + 1}/48)`;
        },
      },
      grid: {
        top: 50,
        bottom: 30,
        left: 15,
        right: 15,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: Array.from({ length: stages.length }, (_, i) => `${i + 1}`),
        axisLabel: { fontSize: 9, interval: 3 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        show: false,
        max: 1.5,
      },
      series: [
        {
          type: 'bar',
          data: barData,
          barWidth: '80%',
          animation: true,
        },
      ],
    };
  };

  /** 统计各阶段时长 */
  const getStageStats = () => {
    if (!stagesData?.stages) return null;
    const stats = { 0: 0, 1: 0, 2: 0, 3: 0 };
    stagesData.stages.forEach((s) => { stats[s as keyof typeof stats]++; });
    // 每个点=10分钟
    return {
      awake: stats[0] * 10,
      light: stats[1] * 10,
      deep: stats[2] * 10,
      rem: stats[3] * 10,
    };
  };

  const stats = getStageStats();

  return (
    <View className={styles.reportPage}>
      {/* 头部 */}
      <View className={styles.header}>
        <Text className={styles.title}>睡眠分期报告</Text>
      </View>

      {/* 日期选择器 */}
      <View className={styles.datePicker}>
        <Text className={styles.dateLabel}>选择日期：</Text>
        <Picker
          mode="date"
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.detail.value);
          }}
        >
          <View className={styles.dateValue}>
            <Text>{selectedDate}</Text>
            <Text className={styles.arrow}>▼</Text>
          </View>
        </Picker>
      </View>

      {/* 图表区域 */}
      <View className={styles.chartArea}>
        {loading ? (
          <View className={styles.loadingBox}>
            <Text>正在加载分期数据...</Text>
          </View>
        ) : (
          <EcCanvas option={getChartOption()} width={340} height={260} />
        )}
      </View>

      {/* 图例说明 */}
      <View className={styles.legend}>
        {Object.entries(STAGE_LABELS).map(([key, label]) => (
          <View key={key} className={styles.legendItem}>
            <View
              className={styles.legendColor}
              style={{ backgroundColor: STAGE_COLORS[Number(key)] }}
            />
            <Text className={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* 统计信息 */}
      {stats && (
        <View className={styles.statsArea}>
          <Text className={styles.statsTitle}>各阶段时长统计</Text>
          <View className={styles.statsGrid}>
            <View className={styles.statItem}>
              <Text className={styles.statValue} style={{ color: STAGE_COLORS[0] }}>
                {stats.awake}min
              </Text>
              <Text className={styles.statLabel}>清醒</Text>
            </View>
            <View className={styles.statItem}>
              <Text className={styles.statValue} style={{ color: STAGE_COLORS[1] }}>
                {stats.light}min
              </Text>
              <Text className={styles.statLabel}>浅睡</Text>
            </View>
            <View className={styles.statItem}>
              <Text className={styles.statValue} style={{ color: STAGE_COLORS[2] }}>
                {stats.deep}min
              </Text>
              <Text className={styles.statLabel}>深睡</Text>
            </View>
            <View className={styles.statItem}>
              <Text className={styles.statValue} style={{ color: STAGE_COLORS[3] }}>
                {stats.rem}min
              </Text>
              <Text className={styles.statLabel}>REM</Text>
            </View>
          </View>
        </View>
      )}

      {/* 编码说明 */}
      <View className={styles.encodingNote}>
        <Text className={styles.noteText}>
          数据编码：0=清醒 / 1=浅睡 / 2=深睡 / 3=REM（共{stagesData?.total_points ?? '--'}个采样点，每点10分钟）
        </Text>
      </View>
    </View>
  );
};

export default ReportPage;
