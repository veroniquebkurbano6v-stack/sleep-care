/**
 * 睡眠评估干预系统 - 全局配置
 * @author Developer
 * @created 2026-06-22
 */

export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/login/index',
    'pages/devices/index',
    'pages/mine/index',
    'pages/index/index',
  ],
  tabBar: {
    color: '#86909c',
    selectedColor: '#4a6cf7',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/home/index', text: '首页' },
      { pagePath: 'pages/devices/index', text: '设备' },
      { pagePath: 'pages/mine/index', text: '我的' },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#4a6cf7',
    navigationBarTitleText: '睡眠评估干预系统',
    navigationBarTextStyle: 'white',
    backgroundColor: '#f0f2f8',
  },
});
