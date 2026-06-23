/**
 * 作息设置页面
 * 使用 picker (mode="time") 选择就寝/起床时间
 * 使用 slider 调节日出模拟时长
 * @author Developer
 * @created 2026-06-23
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Picker, Slider } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { request } from '@/services/api';

/** 设置数据类型 */
interface SettingData {
  bed_time: string;
  wake_time: string;
  sunrise_duration_minutes: number;
}

const SettingsPage = () => {
  const [bedTime, setBedTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sunriseDuration, setSunriseDuration] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /** 加载设置 */
  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await request<SettingData>('GET', '/api/setting/plan');
      setBedTime(data.bed_time || '23:00');
      setWakeTime(data.wake_time || '07:00');
      setSunriseDuration(data.sunrise_duration_minutes || 10);
      console.log('[Settings] 加载成功', data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败';
      console.error('[Settings]', msg);
      Taro.showToast({ title: msg, icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  /** 就寝时间变化 */
  const onBedTimeChange = (e) => {
    setBedTime(e.detail.value);
  };

  /** 起床时间变化 */
  const onWakeTimeChange = (e) => {
    setWakeTime(e.detail.value);
  };

  /** 日出模拟时长变化 */
  const onSunriseChange = (e) => {
    setSunriseDuration(e.detail.value);
  };

  /** 保存设置 */
  const saveSettings = async () => {
    if (saving) return;

    setSaving(true);
    try {
      await request<SettingData>('PUT', '/api/setting/plan', {
        bed_time: bedTime,
        wake_time: wakeTime,
        sunrise_duration_minutes: sunriseDuration,
      });
      Taro.showToast({ title: '保存成功', icon: 'success' });
      console.log('[Settings] 保存成功');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败';
      Taro.showToast({ title: msg, icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  // 加载中状态
  if (loading) {
    return (
      <View className={styles.settingsPage}>
        <View className={styles.loadingArea}>
          <Text className={styles.loadingText}>正在加载设置...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className={styles.settingsPage}>
      {/* 标题 */}
      <View className={styles.pageTitle}>
        <Text>作息设置</Text>
      </View>

      {/* 设置卡片 */}
      <View className={styles.card}>
        {/* 就寝时间 */}
        <View className={styles.settingItem}>
          <View className={styles.settingLabel}>
            <Text className={styles.labelIcon}>🌙</Text>
            <Text className={styles.labelText}>就寝时间</Text>
          </View>
          <Picker mode="time" value={bedTime} onChange={onBedTimeChange}>
            <View className={styles.pickerBox}>
              <Text className={styles.pickerValue}>{bedTime}</Text>
              <Text className={styles.pickerArrow}>▾</Text>
            </View>
          </Picker>
        </View>

        <View className={styles.divider} />

        {/* 起床时间 */}
        <View className={styles.settingItem}>
          <View className={styles.settingLabel}>
            <Text className={styles.labelIcon}>☀</Text>
            <Text className={styles.labelText}>起床时间</Text>
          </View>
          <Picker mode="time" value={wakeTime} onChange={onWakeTimeChange}>
            <View className={styles.pickerBox}>
              <Text className={styles.pickerValue}>{wakeTime}</Text>
              <Text className={styles.pickerArrow}>▾</Text>
            </View>
          </Picker>
        </View>

        <View className={styles.divider} />

        {/* 日出模拟时长 */}
        <View className={styles.settingItem}>
          <View className={styles.settingLabel}>
            <Text className={styles.labelIcon}>🌅</Text>
            <Text className={styles.labelText}>日出模拟时长</Text>
          </View>
          <View className={styles.sliderWrap}>
            <Slider
              min={5}
              max={30}
              step={1}
              value={sunriseDuration}
              activeColor="#4a6cf7"
              backgroundColor="#e8e8e8"
              blockSize={18}
              showValue
              onChange={onSunriseChange}
            />
            <Text className={styles.sliderUnit}>分钟</Text>
          </View>
        </View>
      </View>

      {/* 保存按钮 */}
      <View className={styles.saveBtnArea}>
        <View
          className={`${styles.saveBtn} ${saving ? styles['saveBtn--disabled'] : ''}`}
          onClick={saveSettings}
        >
          <Text className={styles.saveBtnText}>{saving ? '保存中...' : '保存设置'}</Text>
        </View>
      </View>

      {/* 提示信息 */}
      <View className={styles.tipsArea}>
        <Text className={styles.tipsText}>
          建议每天保持固定的作息时间，有助于改善睡眠质量。
        </Text>
      </View>
    </View>
  );
};

export default SettingsPage;
