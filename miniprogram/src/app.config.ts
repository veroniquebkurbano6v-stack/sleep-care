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
    'pages/report/index',
    'pages/settings/settings',
    'pages/doctors/doctors',
    'pages/index/index',
  ],
  tabBar: {
    color: '#86909c',
    selectedColor: '#4a6cf7',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/home/index', text: '首页', iconPath: 'images/home.png', selectedIconPath: 'images/home_active.png' },
      { pagePath: 'pages/devices/index', text: '设备', iconPath: 'images/device.png', selectedIconPath: 'images/device_active.png' },
      { pagePath: 'pages/report/index', text: '报告', iconPath: 'images/report.png', selectedIconPath: 'images/report_active.png' },
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
