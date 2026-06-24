/**
 * 医生授权管理页面
 * 实现添加医生授权、查看已授权列表、撤销授权功能
 * @author Developer
 * @created 2026-06-23
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { request } from '@/services/api';
import './doctors.scss';

/** 医生授权记录类型 */
interface DoctorAuth {
  id: number;
  doctor_id: number;
  doctor_name: string;
  doctor_phone: string;
  status: string;
  status_text: string;
  requested_at: string;
  expire_date: string;
}

const DoctorsPage = () => {
  const [list, setList] = useState<DoctorAuth[]>([]);
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  /** 加载已授权医生列表 - loadGrantedList */
  const loadGrantedList = async () => {
    setLoading(true);
    try {
      const data = await request<{ list: DoctorAuth[] }>('GET', '/api/doctor/granted');
      setList(data.list || []);
      console.log('[Doctors] 列表加载成功', data.list?.length || 0, '条');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败';
      console.error('[Doctors]', msg);
      Taro.showToast({ title: msg, icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGrantedList();
  }, []);

  /** 添加授权 - onGrantDoctor */
  const onGrantDoctor = async () => {
    if (adding) return;

    const phone = phoneInput.trim();
    if (!phone) {
      Taro.showToast({ title: '请输入医生手机号', icon: 'none' });
      return;
    }

    if (!/^1\d{10}$/.test(phone)) {
      Taro.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }

    setAdding(true);
    try {
      await request<DoctorAuth>('POST', '/api/doctor/grant', { doctor_phone: phone });
      Taro.showToast({ title: '授权成功', icon: 'success' });
      setPhoneInput('');
      loadGrantedList(); // 刷新列表
    } catch (err) {
      const msg = err instanceof Error ? err.message : '授权失败';
      Taro.showToast({ title: msg, icon: 'none' });
    } finally {
      setAdding(false);
    }
  };

  /** 撤销授权（弹窗确认） - onRevokeDoctor */
  const onRevokeDoctor = (authId: number, doctorName: string) => {
    Taro.showModal({
      title: '确认撤销',
      content: `确定要撤销对「${doctorName}」的授权吗？`,
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          await request('DELETE', `/api/doctor/revoke?auth_id=${authId}`);
          Taro.showToast({ title: '撤销成功', icon: 'success' });
          loadGrantedList(); // 刷新列表
        } catch (err) {
          const msg = err instanceof Error ? err.message : '撤销失败';
          Taro.showToast({ title: msg, icon: 'none' });
        }
      },
    });
  };

  /** 状态标签颜色 */
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'status-badge--pending';
      case 'active': return 'status-badge--active';
      default: return '';
    }
  };

  // 加载中状态
  if (loading) {
    return (
      <View className="doctors-page">
        <View className="doctors-loading">
          <Text className="doctors-loading-text">正在加载...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="doctors-page">
      {/* 标题 */}
      <View className="doctors-header">
        <Text className="doctors-title">医生授权管理</Text>
        <Text className="doctors-subtitle">管理您的医生查看权限</Text>
      </View>

      {/* 已授权医生列表 */}
      <View className="doctors-list">
        {list.length === 0 && !loading && (
          <View className="doctors-empty">
            <Text className="doctors-empty-icon">👨‍⚕️</Text>
            <Text className="doctors-empty-text">暂无授权医生</Text>
            <Text className="doctors-empty-hint">请在下方添加需要授权的医生</Text>
          </View>
        )}

        {list.map((item) => (
          <View key={item.id} className="doctor-card">
            <View className="doctor-info">
              <View className="doctor-avatar">
                <Text>{item.doctor_name.charAt(0)}</Text>
              </View>
              <View className="doctor-detail">
                <Text className="doctor-name">{item.doctor_name}</Text>
                <Text className="doctor-phone">{item.doctor_phone}</Text>
              </View>
              <View className={`status-badge ${getStatusStyle(item.status)}`}>
                <Text className="status-text">{item.status_text}</Text>
              </View>
            </View>
            <View className="doctor-meta">
              <Text className="meta-item">过期：{item.expire_date}</Text>
              <View
                className="revoke-btn"
                onClick={() => onRevokeDoctor(item.id, item.doctor_name)}
              >
                <Text className="revoke-btn-text">撤销</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* 底部添加区域 */}
      <View className="add-area">
        <View className="add-input-wrap">
          <Input
            className="add-input"
            type="text"
            placeholder="请输入医生手机号"
            value={phoneInput}
            maxlength={11}
            onInput={(e) => setPhoneInput(e.detail.value)}
            confirmType="done"
          />
          <View
            className={`add-btn ${adding ? 'add-btn--disabled' : ''}`}
            onClick={onGrantDoctor}
          >
            <Text className="add-btn-text">{adding ? '添加中...' : '添加'}</Text>
          </View>
        </View>
        <Text className="add-hint">提示：仅可添加已注册的医生账号</Text>
      </View>
    </View>
  );
};

/** 页面配置 */
export const pageConfig = {
  navigationBarTitleText: '医生授权',
};

export default DoctorsPage;
