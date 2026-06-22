/**
 * 认证状态管理工具
 * 管理 Token 和用户信息的存取与清理
 * @author Developer
 * @created 2026-06-22
 */

import Taro from '@tarojs/taro';
import type { UserInfo } from '@/types';

const TOKEN_KEY = 'token';
const USER_INFO_KEY = 'userInfo';

/** 保存登录信息 */
export function saveAuthInfo(token: string, user: UserInfo): void {
  Taro.setStorageSync(TOKEN_KEY, token);
  Taro.setStorageSync(USER_INFO_KEY, user);
  console.log('[Auth] 登录信息已保存');
}

/** 获取当前 Token */
export function getToken(): string {
  return Taro.getStorageSync(TOKEN_KEY) || '';
}

/** 获取当前用户信息 */
export function getUserInfo(): UserInfo | null {
  const info = Taro.getStorageSync(USER_INFO_KEY);
  return info || null;
}

/** 判断是否已登录 */
export function isLoggedIn(): boolean {
  return !!getToken();
}

/** 清除登录信息（登出） */
export function clearAuthInfo(): void {
  Taro.removeStorageSync(TOKEN_KEY);
  Taro.removeStorageSync(USER_INFO_KEY);
  console.log('[Auth] 登录信息已清除');
}
