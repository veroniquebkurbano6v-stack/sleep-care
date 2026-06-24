/**
 * 医生授权管理页面
 * 实现从列表选择医生进行授权、查看已授权列表、撤销授权功能
 * @author Developer
 * @created 2026-06-23
 */

import React, { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { request } from '@/services/api';
import './doctors.scss';

/** 医生选项（来自 /api/users/doctors） */
interface DoctorItem {
  id: number;
  phone: string;
  nickname: string;
}

/** 已授权记录 */
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
  const [doctorList, setDoctorList] = useState<DoctorItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  /** 加载可选择的医生列表 - loadDoctors */
  const loadDoctors = async () => {
    try {
      const data = await request<{ list: DoctorItem[] }>('GET', '/api/users/doctors');
      setDoctorList(data.list || []);
    } catch (err) {
      console.error('[Doctors] loadDoctors error:', err);
    }
  };

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
    loadDoctors();
    loadGrantedList();
  }, []);

  /** 选择医生 - selectDoctor */
  const selectDoctor = (doctor: DoctorItem) => {
    setSelectedId(doctor.id === selectedId ? null : doctor.id);
  };

  /** 授权选中的医生 - onGrantDoctor */
  const onGrantDoctor = async () => {
    if (!selectedId) {
      Taro.showToast({ title: '请先选择一位医生', icon: 'none' });
      return;
    }
    if (adding) return;

    setAdding(true);
    try {
      // 使用 doctor_id 进行授权（第11大节新增支持）
      await request<DoctorAuth>('POST', '/api/doctor/grant', { doctor_id: selectedId });
      Taro.showToast({ title: '授权成功', icon: 'success' });
      setSelectedId(null);
      loadGrantedList();
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
          loadGrantedList();
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

  /** 获取选中医生的名称 */
  const getSelectedName = () => {
    const found = doctorList.find(d => d.id === selectedId);
    return found ? found.nickname : '';
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
        <Text className="doctors-subtitle">从下方列表选择一位医生进行授权</Text>
      </View>

      {/* 可选择的医生列表 */}
      <View className="doctors-list" style={{ marginBottom: 16 }}>
        <View style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 12 }}>
          可选医生
        </View>
        {doctorList.length === 0 && (
          <View className="doctors-empty">
            <Text className="doctors-empty-icon">👨‍⚕️</Text>
            <Text className="doctors-empty-text">暂无可用医生</Text>
            <Text className="doctors-empty-hint">请联系管理员添加医生账号</Text>
          </View>
        )}
        {doctorList.map((doc) => (
          <View
            key={doc.id}
            className={`doctor-select-card ${selectedId === doc.id ? 'doctor-select-card--active' : ''}`}
            onClick={() => selectDoctor(doc)}
          >
            <View className="doctor-info">
              <View className="doctor-avatar">
                <Text>{doc.nickname.charAt(0)}</Text>
              </View>
              <View className="doctor-detail">
                <Text className="doctor-name">{doc.nickname}</Text>
                <Text className="doctor-phone">{doc.phone}</Text>
              </View>
              {selectedId === doc.id && (
                <View className="select-check">
                  <Text className="select-check-icon">✓</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* 已授权医生列表 */}
      <View className="doctors-list">
        <View style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 12 }}>
          已授权医生
        </View>
        {list.length === 0 && (
          <View className="doctors-empty">
            <Text className="doctors-empty-icon">📋</Text>
            <Text className="doctors-empty-text">暂无授权医生</Text>
            <Text className="doctors-empty-hint">请在上方选择一位医生进行授权</Text>
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

      {/* 底部操作区域 */}
      <View className="add-area">
        {selectedId !== null && (
          <Text style={{ textAlign: 'center', color: '#667eea', fontSize: 13, marginBottom: 8 }}>
            已选择：{getSelectedName()}
          </Text>
        )}
        <View
          className={`grant-btn ${adding ? 'grant-btn--disabled' : ''}`}
          onClick={onGrantDoctor}
        >
          <Text className="grant-btn-text">{adding ? '授权中...' : '授权'}</Text>
        </View>
        <Text className="add-hint">点击上方卡片选择要授权的医生，然后点击授权按钮</Text>
      </View>
    </View>
  );
};

/** 页面配置 */
export const pageConfig = {
  navigationBarTitleText: '医生授权',
};

export default DoctorsPage;
