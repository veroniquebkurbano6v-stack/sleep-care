/**
 * 设备管理页面
 * 展示设备列表，支持添加、编辑、删除操作
 * @author Developer
 * @created 2026-06-22
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Button, Input, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { deviceApi } from '@/services/api';
import { isLoggedIn } from '@/utils/auth';
import type { DeviceInfo } from '@/types';
import styles from './index.module.scss';

const DevicesPage = () => {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editDevice, setEditDevice] = useState<DeviceInfo | null>(null);
  const [inputName, setInputName] = useState('');

  /** 加载设备列表 */
  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await deviceApi.list();
      setDevices(data.list || []);
      console.log('[Devices] 加载完成，共', data.list?.length || 0, '台设备');
    } catch (err) {
      console.error('[Devices] 加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      Taro.redirectTo({ url: '/pages/login/index' });
      return;
    }
    fetchDevices();
  }, []);

  /** 打开添加弹窗 */
  const openAddModal = () => {
    setEditDevice(null);
    setInputName('');
    setShowModal(true);
  };

  /** 打开编辑弹窗 */
  const openEditModal = (device: DeviceInfo) => {
    setEditDevice(device);
    setInputName(device.name);
    setShowModal(true);
  };

  /** 关闭弹窗 */
  const closeModal = () => {
    setShowModal(false);
    setEditDevice(null);
    setInputName('');
  };

  /** 提交添加/编辑 */
  const handleSubmit = async () => {
    if (!inputName.trim()) {
      Taro.showToast({ title: '请输入设备名称', icon: 'none' });
      return;
    }

    try {
      if (editDevice) {
        // 编辑
        await deviceApi.update(editDevice.device_id, { name: inputName.trim() });
        Taro.showToast({ title: '更新成功', icon: 'success' });
      } else {
        // 添加（默认虚拟设备）
        await deviceApi.add({ name: inputName.trim(), is_virtual: 1 });
        Taro.showToast({ title: '添加成功', icon: 'success' });
      }
      closeModal();
      fetchDevices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      Taro.showToast({ title: msg, icon: 'none' });
    }
  };

  /** 删除确认 */
  const handleDelete = (device: DeviceInfo) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除「${device.name}」吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await deviceApi.remove(device.device_id);
            Taro.showToast({ title: '删除成功', icon: 'success' });
            fetchDevices();
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '删除失败';
            Taro.showToast({ title: msg, icon: 'none' });
          }
        }
      },
    });
  };

  /** 格式化时间 */
  const formatTime = (time?: string): string => {
    if (!time) return '-';
    return time.replace('T', ' ').substring(0, 16);
  };

  return (
    <View className={styles.devicesPage}>
      {/* 页面头部 */}
      <View className={styles.pageHeader}>
        <Text className={styles.headerTitle}>我的设备</Text>
        <Button className={styles.addBtn} onClick={openAddModal}>+ 添加设备</Button>
      </View>

      {/* 设备列表 */}
      {devices.length === 0 && !loading ? (
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>📱</Text>
          <Text className={styles.emptyText}>暂无设备，点击上方按钮添加</Text>
          <Button className={styles.addBtn} onClick={openAddModal}>立即添加</Button>
        </View>
      ) : (
        <ScrollView scrollY style={{ height: 'calc(100vh - 200rpx)' }}>
          <View className={styles.deviceList}>
            {devices.map((device) => (
              <View key={device.device_id} className={styles.deviceCard}>
                <View className={styles.cardHeader}>
                  <Text className={styles.deviceName}>{device.name}</Text>
                  {device.is_virtual === 1 ? (
                    <Text className={styles.virtualTag}>虚拟设备</Text>
                  ) : (
                    <Text className={styles.realTag}>真实设备</Text>
                  )}
                </View>

                <View className={styles.cardBody}>
                  <View className={styles.infoRow}>
                    <Text className={styles.infoLabel}>序列号：</Text>
                    <Text className={styles.infoValue}>{device.serial_no || '-'}</Text>
                  </View>
                  <View className={styles.infoRow}>
                    <Text className={styles.infoLabel}>固件版本：</Text>
                    <Text className={styles.infoValue}>{device.firmware_version}</Text>
                  </View>
                  <View className={styles.infoRow}>
                    <Text className={styles.infoLabel}>创建时间：</Text>
                    <Text className={styles.infoValue}>{formatTime(device.created_at)}</Text>
                  </View>
                </View>

                <View className={styles.cardActions}>
                  <Button
                    className={`${styles.actionBtn} ${styles.editBtn}`}
                    onClick={() => openEditModal(device)}
                  >
                    编辑
                  </Button>
                  <Button
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    onClick={() => handleDelete(device)}
                  >
                    删除
                  </Button>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* 添加/编辑弹窗 */}
      {showModal && (
        <View className={styles.modalOverlay} onClick={closeModal}>
          <View
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <Text className={styles.modalTitle}>
              {editDevice ? '编辑设备' : '添加虚拟设备'}
            </Text>

            <Input
              className={styles.modalInput}
              placeholder="请输入设备名称"
              value={inputName}
              maxlength={20}
              onInput={(e) => setInputName(e.detail.value)}
              focus
            />

            <View className={styles.modalActions}>
              <Button className={`${styles.modalBtn} ${styles.cancelBtn}`} onClick={closeModal}>
                取消
              </Button>
              <Button
                className={`${styles.modalBtn} ${styles.confirmBtn}`}
                onClick={handleSubmit}
              >
                {editDevice ? '保存修改' : '确认添加'}
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default DevicesPage;
