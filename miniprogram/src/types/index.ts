/**
 * 睡眠评估干预系统 - 类型定义
 * @author Developer
 * @created 2026-06-22
 */

/** API 统一响应结构 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
}

/** 用户信息 */
export interface UserInfo {
  user_id: number;
  phone: string;
  nickname: string;
  gender?: number;
  birth_year?: number;
  role: number;
  status?: number;
  created_at?: string;
}

/** 登录响应 */
export interface LoginData {
  token: string;
  user: UserInfo;
}

/** 设备信息 */
export interface DeviceInfo {
  device_id: string;
  serial_no?: string;
  name: string;
  is_virtual: number;
  firmware_version: string;
  last_active_time?: string;
  created_at?: string;
  updated_at?: string;
}

/** 设备列表响应 */
export interface DeviceListData {
  list: DeviceInfo[];
}

/** 注册请求参数 */
export interface RegisterParams {
  phone: string;
  password: string;
  nickname?: string;
  gender?: number;
  birth_year?: number;
}

/** 登录请求参数 */
export interface LoginParams {
  phone: string;
  password: string;
}

/** 添加设备请求参数 */
export interface AddDeviceParams {
  name: string;
  is_virtual?: number;
}

/** 更新设备请求参数 */
export interface UpdateDeviceParams {
  name: string;
}

/** 睡眠评分汇总响应 */
export interface SleepSummaryData {
  period: 'day' | 'week' | 'month';
  labels: string[];
  scores: number[];
  avg_score: number;
}
