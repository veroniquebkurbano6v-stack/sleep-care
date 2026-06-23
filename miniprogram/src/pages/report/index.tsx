/**
 * 睡眠分期报告页
 * 展示睡眠分期柱状图 + 噪音折线图 + 评分趋势图，支持日期切换和日/周/月视图切换
 * @author Developer
 * @created 2026-06-23
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Picker } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import StageBarChart from '@/components/ec-canvas/index';
import NoiseLineChart from '@/components/noise-line-chart/index';
import ScoreTrendChart from '@/components/score-trend-chart/index';
import { request, sleepApi } from '@/services/api';
import { isLoggedIn } from '@/utils/auth';
import type { SleepSummaryData } from '@/types';
import styles from './index.module.scss';

/** 分期数据响应类型 */
interface StagesResponse {
  date: string;
  total_points: number;
  stages: number[];
  encoding: string;
}

/** 噪音数据响应类型 */
interface NoiseResponse {
  date: string;
  total_points: number;
  noise: number[];
  unit: string;
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
  const [noiseData, setNoiseData] = useState<NoiseResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // 新增：日/周/月视图状态
  const [currentPeriod, setCurrentPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [summaryData, setSummaryData] = useState<SleepSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  /** 获取分期数据 */
  const fetchStages = async (date: string) => {
    try {
      const data = await request<StagesResponse>('GET', `/api/sleep/stages?date=${date}`);
      setStagesData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败';
      console.error('[Report Stages]', msg);
    }
  };

  /** 获取噪音数据 */
  const fetchNoise = async (date: string) => {
    try {
      const data = await request<NoiseResponse>('GET', `/api/sleep/noise?date=${date}`);
      setNoiseData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败';
      console.error('[Report Noise]', msg);
    }
  };

  /** 同时获取分期和噪音数据（联动刷新） */
  const fetchData = async (date: string) => {
    setLoading(true);
    await Promise.all([fetchStages(date), fetchNoise(date)]);
    setLoading(false);
  };

  /** 获取睡眠评分汇总数据 */
  const loadSummary = async (period: 'day' | 'week' | 'month') => {
    setSummaryLoading(true);
    try {
      const data = await sleepApi.getSummary(period);
      setSummaryData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载评分汇总失败';
      console.error('[Report Summary]', msg);
    } finally {
      setSummaryLoading(false);
    }
  };

  /** 切换视图周期 */
  const switchPeriod = (period: 'day' | 'week' | 'month') => {
    setCurrentPeriod(period);
    loadSummary(period);
  };

  useDidShow(() => {
    if (!isLoggedIn()) {
      Taro.redirectTo({ url: '/pages/login/index' });
      return;
    }
    fetchData(selectedDate);
    loadSummary(currentPeriod);
  });

  useEffect(() => {
    if (!isLoggedIn()) return;
    fetchData(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (!isLoggedIn()) return;
    loadSummary(currentPeriod);
  }, [currentPeriod]);

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

  /** 计算噪音统计 */
  const getNoiseStats = () => {
    if (!noiseData?.noise || noiseData.noise.length === 0) return null;
    const data = noiseData.noise;
    const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length * 10) / 10;
    const max = Math.max(...data);
    const min = Math.min(...data);
    // 夜间平均（22:00-06:00，即索引132-143和0-35）
    const nightValues = [];
    for (let i = 132; i < 144; i++) nightValues.push(data[i]);
    for (let i = 0; i < 36; i++) nightValues.push(data[i]);
    const nightAvg = nightValues.length > 0
      ? Math.round(nightValues.reduce((a, b) => a + b, 0) / nightValues.length * 10) / 10
      : 0;
    return { avg, max, min, nightAvg };
  };

  const stats = getStageStats();
  const noiseStats = getNoiseStats();

  return (
    <View className={styles.reportPage}>
      {/* 头部 */}
      <View className={styles.header}>
        <Text className={styles.title}>睡眠分析报告</Text>
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

      {/* 日/周/月视图切换按钮 */}
      <View className={styles.periodSwitcher}>
        <View
          className={`${styles.periodBtn} ${currentPeriod === 'day' ? styles.active : ''}`}
          onClick={() => switchPeriod('day')}
        >
          <Text>日视图</Text>
        </View>
        <View
          className={`${styles.periodBtn} ${currentPeriod === 'week' ? styles.active : ''}`}
          onClick={() => switchPeriod('week')}
        >
          <Text>周视图</Text>
        </View>
        <View
          className={`${styles.periodBtn} ${currentPeriod === 'month' ? styles.active : ''}`}
          onClick={() => switchPeriod('month')}
        >
          <Text>月视图</Text>
        </View>
      </View>

      {/* 评分趋势图 */}
      <View className={styles.chartArea}>
        <Text className={styles.chartTitle}>睡眠评分趋势</Text>
        {summaryLoading ? (
          <View className={styles.loadingBox}>
            <Text>正在加载评分数据...</Text>
          </View>
        ) : summaryData ? (
          <ScoreTrendChart
            labels={summaryData.labels}
            scores={summaryData.scores}
            avgScore={summaryData.avg_score}
            width={340}
            height={200}
          />
        ) : (
          <View className={styles.loadingBox}>
            <Text>暂无评分数据</Text>
          </View>
        )}
      </View>

      {/* 分期柱状图 */}
      <View className={styles.chartArea}>
        <Text className={styles.chartTitle}>Sleep Stages</Text>
        {loading ? (
          <View className={styles.loadingBox}>
            <Text>正在加载数据...</Text>
          </View>
        ) : (
          <StageBarChart stages={stagesData?.stages || []} width={340} height={240} />
        )}
      </View>

      {/* 分期图例 */}
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

      {/* 噪音折线图 */}
      <View className={styles.chartArea}>
        <Text className={styles.chartTitle}>Noise Level</Text>
        {loading ? (
          <View className={styles.loadingBox}>
            <Text>正在加载噪音数据...</Text>
          </View>
        ) : (
          <NoiseLineChart noise={noiseData?.noise || []} width={340} height={200} />
        )}
      </View>

      {/* 统计信息 */}
      <View className={styles.statsRow}>
        {/* 各阶段时长统计 */}
        {stats && (
          <View className={styles.statsCard}>
            <Text className={styles.statsTitle}>各阶段时长</Text>
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

        {/* 噪音统计 */}
        {noiseStats && (
          <View className={styles.statsCard}>
            <Text className={styles.statsTitle}>噪音统计</Text>
            <View className={styles.statsGrid}>
              <View className={styles.statItem}>
                <Text className={styles.statValue} style={{ color: '#4a6cf7' }}>
                  {noiseStats.avg}dB
                </Text>
                <Text className={styles.statLabel}>均值</Text>
              </View>
              <View className={styles.statItem}>
                <Text className={styles.statValue} style={{ color: '#ff6b6b' }}>
                  {noiseStats.max}dB
                </Text>
                <Text className={styles.statLabel}>峰值</Text>
              </View>
              <View className={styles.statItem}>
                <Text className={styles.statValue} style={{ color: '#51cf66' }}>
                  {noiseStats.min}dB
                </Text>
                <Text className={styles.statLabel}>谷值</Text>
              </View>
              <View className={styles.statItem}>
                <Text className={styles.statValue} style={{ color: '#845ef7' }}>
                  {noiseStats.nightAvg}dB
                </Text>
                <Text className={styles.statLabel}>夜间均</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* 编码说明 */}
      <View className={styles.encodingNote}>
        <Text className={styles.noteText}>
          数据编码：0=清醒 / 1=浅睡 / 2=深睡 / 3=REM | 噪音单位：dB（共{stagesData?.total_points ?? '--'}个采样点，每点10分钟）
        </Text>
      </View>
    </View>
  );
};

export default ReportPage;
