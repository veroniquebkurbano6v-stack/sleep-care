/**
 * API 请求封装
 * 封装 Taro.request，统一处理鉴权、错误、响应解包
 * @author Developer
 * @created 2026-06-22
 */

import Taro from '@tarojs/taro';
import type { ApiResponse } from '@/types';

// 后端服务地址（开发环境）
const BASE_URL = 'http://localhost:3000';

/**
 * 获取本地存储的 Token
 */
function getToken(): string {
  return Taro.getStorageSync('token') || '';
}

/**
 * 封装的通用请求方法（命名导出）
 * @param {string} method HTTP 方法
 * @param {string} url 接口路径
 * @param {object} data 请求数据
 * @returns {Promise<ApiResponse<T>>} 解包后的业务数据
 */
export async function request<T>(method: string, url: string, data?: object): Promise<T> {
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getToken();
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  console.log(`[API] ${method} ${url}`, data || '');

  const res = await Taro.request({
    url: `${BASE_URL}${url}`,
    method,
    data,
    header,
    timeout: 15000,
  });

  const body = res.data as ApiResponse<T>;

  if (body.code !== 0) {
    // 未授权 → 清除 token 并跳转登录
    if (body.code === 401) {
      Taro.removeStorageSync('token');
      Taro.removeStorageSync('userInfo');
      Taro.redirectTo({ url: '/pages/login/index' });
      throw new Error('登录已过期，请重新登录');
    }
    throw new Error(body.message || '请求失败');
  }

  return body.data as T;
}

/** Auth 相关接口 */
export const authApi = {
  /** 注册 */
  register(data: { phone: string; password: string; nickname?: string }) {
    return request<{ user: import('@/types').UserInfo }>('POST', '/api/v1/auth/register', data);
  },

  /** 登录 */
  login(data: { phone: string; password: string }) {
    return request<import('@/types').LoginData>('POST', '/api/v1/auth/login', data);
  },

  /** 获取当前用户 */
  getMe() {
    return request<{ user: import('@/types').UserInfo }>('GET', '/api/v1/users/me');
  },
};

/** 设备管理接口 */
export const deviceApi = {
  /** 查询设备列表 */
  list() {
    return request<import('@/types').DeviceListData>('GET', '/api/v1/devices/list');
  },

  /** 添加设备 */
  add(data: { name: string; is_virtual?: number }) {
    return request<{ device: import('@/types').DeviceInfo }>('POST', '/api/v1/devices/add', data);
  },

  /** 更新设备 */
  update(deviceId: string, data: { name: string }) {
    return request<{ device: import('@/types').DeviceInfo }>('PUT', `/api/v1/devices/${deviceId}`, data);
  },

  /** 删除设备 */
  remove(deviceId: string) {
    return request<void>('DELETE', `/api/v1/devices/${deviceId}`);
  },
};

/** 睡眠评分汇总接口 */
export const sleepApi = {
  /** 获取睡眠评分汇总（日/周/月视图） */
  getSummary(period: 'day' | 'week' | 'month') {
    return request<import('@/types').SleepSummaryData>('GET', `/api/sleep/summary?period=${period}`);
  },
};

/** 作息设置接口 */
export const settingApi = {
  /** 获取作息设置 */
  getPlan() {
    return request<{ bed_time: string; wake_time: string; sunrise_duration_minutes: number }>('GET', '/api/setting/plan');
  },

  /** 更新作息设置 */
  savePlan(data: { bed_time: string; wake_time: string; sunrise_duration_minutes: number }) {
    return request<{ bed_time: string; wake_time: string; sunrise_duration_minutes: number }>('PUT', '/api/setting/plan', data);
  },
};

/** 医生授权接口 */
export const doctorApi = {
  /** 授权医生 */
  grant(doctorPhone: string) {
    return request<{ id: number; doctor_name: string; doctor_phone: string; status: string; expire_date: string }>('POST', '/api/doctor/grant', { doctor_phone: doctorPhone });
  },

  /** 撤销授权 */
  revoke(authId: number) {
    return request<void>('DELETE', `/api/doctor/revoke?auth_id=${authId}`);
  },

  /** 获取已授权列表 */
  getGranted() {
    return request<{ list: Array<{ id: number; doctor_name: string; doctor_phone: string; status: string; status_text: string; expire_date: string }> }>('GET', '/api/doctor/granted');
  },
};

export default request;
