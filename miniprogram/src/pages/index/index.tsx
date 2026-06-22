/**
 * 首页（启动后自动跳转到登录或设备管理）
 * @author Developer
 * @created 2026-06-22
 */

import React, { useEffect } from 'react';
import Taro from '@tarojs/taro';
import { isLoggedIn } from '@/utils/auth';

const IndexPage = () => {
  useEffect(() => {
    if (isLoggedIn()) {
      Taro.switchTab({ url: '/pages/devices/index' });
    } else {
      Taro.redirectTo({ url: '/pages/login/index' });
    }
  }, []);

  return null;
};

export default IndexPage;
