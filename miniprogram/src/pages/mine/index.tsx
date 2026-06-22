/**
 * 我的 - 占位页面
 * 功能开发中...
 * @author Developer
 * @created 2026-06-22
 */

import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';

const MinePage = () => {
  return (
    <View className={styles.minePage}>
      <Text className={styles.placeholderIcon}>👤</Text>
      <Text className={styles.placeholderText}>我的功能开发中...</Text>
    </View>
  );
};

export default MinePage;
