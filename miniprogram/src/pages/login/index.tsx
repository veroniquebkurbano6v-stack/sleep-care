/**
 * 登录/注册页面
 * 支持手机号+密码登录和注册两种模式切换
 * @author Developer
 * @created 2026-06-22
 */

import React, { useState } from 'react';
import { View, Text, Input, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { authApi } from '@/services/api';
import { saveAuthInfo } from '@/utils/auth';
import styles from './index.module.scss';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  /** 切换登录/注册模式 */
  const toggleMode = () => {
    setIsLogin(!isLogin);
    setPhone('');
    setPassword('');
    setNickname('');
  };

  /** 提交表单（登录或注册） */
  const handleSubmit = async () => {
    if (!phone || phone.length < 5) {
      Taro.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    if (!password || password.length < 6) {
      Taro.showToast({ title: '密码至少6位', icon: 'none' });
      return;
    }
    if (!isLogin && (!nickname || nickname.trim() === '')) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // 登录
        const data = await authApi.login({ phone, password });
        saveAuthInfo(data.token, data.user);
        Taro.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/home/index' });
        }, 800);
      } else {
        // 注册
        const data = await authApi.register({ phone, password, nickname: nickname.trim() });
        Taro.showToast({ title: '注册成功，请登录', icon: 'success' });
        setIsLogin(true);
        setPassword('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      Taro.showToast({ title: msg, icon: 'none' });
      console.error('[Login]', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className={styles.loginPage}>
      {/* Logo 区域 */}
      <View className={styles.logoArea}>
        <View className={styles.logoIcon}>
          <Text style={{ fontSize: '56rpx', color: '#fff' }}>Zz</Text>
        </View>
        <Text className={styles.logoText}>睡眠评估干预系统</Text>
        <Text className={styles.logoSubtext}>Sleep Care Assessment System</Text>
      </View>

      {/* 表单卡片 */}
      <View className={styles.formCard}>
        <Text className={styles.formTitle}>{isLogin ? '账号登录' : '注册账号'}</Text>

        <View className={styles.inputGroup}>
          <Text className={styles.inputLabel}>手机号</Text>
          <Input
            className={styles.inputField}
            type="number"
            maxlength={11}
            placeholder="请输入手机号"
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
          />
        </View>

        <View className={styles.inputGroup}>
          <Text className={styles.inputLabel}>密码</Text>
          <Input
            className={styles.inputField}
            type="text"
            password
            maxlength={20}
            placeholder="请输入密码"
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
          />
        </View>

        {!isLogin && (
          <View className={styles.inputGroup}>
            <Text className={styles.inputLabel}>昵称</Text>
            <Input
              className={styles.inputField}
              type="text"
              maxlength={20}
              placeholder="请输入昵称"
              value={nickname}
              onInput={(e) => setNickname(e.detail.value)}
            />
          </View>
        )}

        <Button
          className={`${styles.submitBtn} ${loading ? styles.disabled : ''}`}
          disabled={loading}
          onClick={handleSubmit}
        >
          {loading ? '处理中...' : isLogin ? '登 录' : '注 册'}
        </Button>

        <View className={styles.switchMode}>
          <Button className={styles.switchBtn} onClick={toggleMode}>
            {isLogin ? '没有账号？立即注册' : '已有账号？返回登录'}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default LoginPage;
