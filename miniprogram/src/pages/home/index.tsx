/**
 * 首页 - 睡眠报告展示
 * 展示睡眠评分、总时长、深睡比例、觉醒次数等核心指标
 * 支持下拉刷新
 * 性能优化：使用单一状态对象减少 Taro setData 调用次数
 * @author Developer
 * @created 2026-06-22
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import { request } from '@/services/api';
import { isLoggedIn, clearAuthInfo } from '@/utils/auth';
import type { ApiResponse } from '@/types';
import styles from './index.module.scss';

/** 睡眠报告数据类型 */
interface SleepReport {
  report_id: number;
  report_date: string;
  sleep_score: number;
  total_sleep_minutes: number;
  deep_sleep_minutes: number;
  rem_sleep_minutes: number;
  light_sleep_minutes: number;
  awake_minutes: number;
  awake_count: number;
  avg_heart_rate: number;
}

/** 首页状态类型 - 合并多个 useState 为单一对象，减少 setData 次数 */
interface HomeState {
  report: SleepReport | null;
  loading: boolean;
}

/** 初始状态 */
const INITIAL_STATE: HomeState = {
  report: null,
  loading: true,
};

const HomePage = () => {
  const [state, setState] = useState<HomeState>(INITIAL_STATE);

  /** 格式化分钟数为 "X小时Y分" */
  const formatDuration = useCallback((minutes: number): string => {
    if (!minutes) return '0分';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}min`;
  }, []);

  /** 获取睡眠报告 */
  const fetchReport = useCallback(async (date?: string) => {
    // 合并 loading 和 report 为一次 setState
    setState({ ...state, loading: true });
    try {
      const data = await request<{ report: SleepReport }>(
        'GET',
        `/api/sleep/report/daily${date ? `?date=${date}` : ''}`
      );
      // 单次更新：loading=false + report 数据
      setState({ report: data.report, loading: false });
      console.log('[Home] 报告加载成功', data.report?.sleep_score);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败';
      console.error('[Home]', msg);
      Taro.showToast({ title: msg, icon: 'none' });
      setState({ ...state, loading: false });
    } finally {
      Taro.stopPullDownRefresh();
    }
  }, [state]);

  /** 下拉刷新 - 使用 Taro 原生钩子，支持刷新动画 */
  usePullDownRefresh(() => {
    fetchReport();
  });

  useEffect(() => {
    if (!isLoggedIn()) {
      Taro.redirectTo({ url: '/pages/login/index' });
      return;
    }
    fetchReport();
  }, []);

  const { report, loading } = state;

  /** 计算深睡占比 */
  const getDeepRatio = (): string => {
    if (!report || !report.total_sleep_minutes) return '0%';
    const ratio = ((report.deep_sleep_minutes / report.total_sleep_minutes) * 100).toFixed(1);
    return `${ratio}%`;
  };

  /** 评分等级描述 */
  const getScoreDesc = (score: number): string => {
    if (score >= 90) return '睡眠质量优秀';
    if (score >= 80) return '睡眠质量良好';
    if (score >= 70) return '睡眠质量一般';
    return '需要改善睡眠';
  };

  /** 获取今天的日期文字 */
  const getDateText = (): string => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${month}月${day}日 ${weekDays[now.getDay()]}`;
  };

  // 加载中
  if (loading && !report) {
    return (
      <View className={styles.homePage}>
        <View className={styles.loadingState}>
          <Text className={styles.loadingText}>正在加载睡眠数据...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className={styles.homePage}>
      {/* 头部 */}
      <View className={styles.headerArea}>
        <Text className={styles.greeting}>今日睡眠</Text>
        <Text className={styles.dateLabel}>{getDateText()}</Text>
      </View>

      {/* 睡眠评分卡片 */}
      <View className={styles.scoreCard}>
        <Text className={styles.scoreLabel}>睡眠综合评分</Text>
        <Text className={styles.scoreNumber}>{report?.sleep_score ?? '--'}</Text>
        <Text className={styles.scoreDesc}>{report ? getScoreDesc(report.sleep_score) : ''}</Text>
      </View>

      {/* 核心指标网格 */}
      <View className={styles.metricsGrid}>
        {/* 总时长 */}
        <View className={styles.metricCard}>
          <View className={`${styles.metricIcon} ${styles['metricIcon--time']}`}>
            <Text>⏱</Text>
          </View>
          <Text className={styles.metricValue}>
            {formatDuration(report?.total_sleep_minutes ?? 0)}
          </Text>
          <Text className={styles.metricLabel}>总睡眠时长</Text>
        </View>

        {/* 觉醒次数 */}
        <View className={styles.metricCard}>
          <View className={`${styles.metricIcon} ${styles['metricIcon--awake']}`}>
            <Text>🔔</Text>
          </View>
          <Text className={styles.metricValue}>
            {report?.awake_count ?? 0}
            <Text className={styles.metricUnit}>次</Text>
          </Text>
          <Text className={styles.metricLabel}>夜间觉醒次数</Text>
        </View>

        {/* 深睡时长 */}
        <View className={styles.metricCard}>
          <View className={`${styles.metricIcon} ${styles['metricIcon--deep']}`}>
            <Text>🌙</Text>
          </View>
          <Text className={styles.metricValue}>
            {formatDuration(report?.deep_sleep_minutes ?? 0)}
          </Text>
          <Text className={styles.metricLabel}>深睡时长</Text>
        </View>

        {/* REM时长 */}
        <View className={styles.metricCard}>
          <View className={`${styles.metricIcon} ${styles['metricIcon--rem']}`}>
            <Text>💜</Text>
          </View>
          <Text className={styles.metricValue}>
            {formatDuration(report?.rem_sleep_minutes ?? 0)}
          </Text>
          <Text className={styles.metricLabel}>REM 时长</Text>
        </View>
      </View>

      {/* 深睡比例进度条 */}
      <View className={styles.deepRatioSection}>
        <View className={styles.ratioHeader}>
          <Text className={styles.ratioTitle}>深睡比例</Text>
          <Text className={styles.ratioPercent}>{getDeepRatio()}</Text>
        </View>
        <View className={styles.ratioTrack}>
          <View
            className={styles.ratioFill}
            style={{
              width: report && report.total_sleep_minutes
                ? `${(report.deep_sleep_minutes / report.total_sleep_minutes) * 100}%`
                : '0%',
            }}
          />
        </View>
        <View className={styles.ratioLabels}>
          <Text>建议值：13%-23%</Text>
          <Text>{getDeepRatio()}</Text>
        </View>
      </View>

      {/* 查看详细分期按钮 */}
      <View className={styles.detailBtnArea}>
        <View
          className={styles.detailBtn}
          onClick={() => Taro.navigateTo({ url: '/pages/report/index' })}
        >
          <Text className={styles.detailBtnText}>查看详细分期</Text>
          <Text className={styles.detailBtnArrow}>→</Text>
        </View>
      </View>

      {/* 作息设置入口按钮 */}
      <View className={styles.settingsBtnArea}>
        <View
          className={styles.settingsBtn}
          onClick={() => Taro.navigateTo({ url: '/pages/settings/settings' })}
        >
          <Text className={styles.settingsBtnIcon}>⚙</Text>
          <Text className={styles.settingsBtnText}>作息设置</Text>
          <Text className={styles.settingsBtnArrow}>→</Text>
        </View>
      </View>

      {/* 医生授权入口按钮 - goToDoctors */}
      <View className={styles.doctorsBtnArea}>
        <View
          className={styles.doctorsBtn}
          onClick={() => Taro.navigateTo({ url: '/pages/doctors/doctors' })}
        >
          <Text className={styles.doctorsBtnIcon}>👨‍⚕️</Text>
          <Text className={styles.doctorsBtnText}>医生授权</Text>
          <Text className={styles.doctorsBtnArrow}>→</Text>
        </View>
      </View>
    </View>
  );
};

export default HomePage;
