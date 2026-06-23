/**
 * 生成 tabBar 图标 PNG 文件
 * 使用纯 JavaScript 构造 PNG 二进制数据
 * @author Developer
 * @created 2024-01-01
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// 图像尺寸
const WIDTH = 81;
const HEIGHT = 81;

// 颜色定义
const COLORS = {
  gray: { r: 0x86, g: 0x90, b: 0xc },      // #86909c
  blue: { r: 0x4a, g: 0x6c, b: 0xf7 },      // #4a6cf7
  transparent: { r: 0, g: 0, b: 0, a: 0 }    // 透明
};

// PNG 签名
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * 计算 CRC32 校验值
 */
function crc32(buf) {
  let crc = 0xffffffff;
  const table = new Int32Array(256);

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * 创建 PNG chunk
 */
function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length);

  const chunkData = Buffer.concat([typeBuffer, data]);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(chunkData));

  return Buffer.concat([lengthBuffer, chunkData, crcBuffer]);
}

/**
 * 创建 IHDR chunk
 */
function createIHDR(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);       // 宽度
  data.writeUInt32BE(height, 4);      // 高度
  data[8] = 8;                         // 位深度
  data[9] = 6;                         // 颜色类型：RGBA
  data[10] = 0;                        // 压缩方法
  data[11] = 0;                        // 过滤方法
  data[12] = 0;                        // 隔行扫描方法

  return createChunk('IHDR', data);
}

/**
 * 创建 IDAT chunk
 */
function createIDAT(pixels) {
  // 将像素数组转换为原始图像数据
  // 每行前有一个过滤字节（0 = 无过滤）
  const rawData = [];

  for (let y = 0; y < HEIGHT; y++) {
    rawData.push(0); // 过滤字节
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      rawData.push(
        pixels[idx],     // R
        pixels[idx + 1], // G
        pixels[idx + 2], // B
        pixels[idx + 3]  // A
      );
    }
  }

  const rawBuffer = Buffer.from(rawData);
  const compressed = zlib.deflateSync(rawBuffer);

  return createChunk('IDAT', compressed);
}

/**
 * 创建 IEND chunk
 */
function createIEND() {
  return createChunk('IEND', Buffer.alloc(0));
}

/**
 * 生成完整的 PNG 文件
 */
function generatePNG(pixels) {
  const parts = [
    PNG_SIGNATURE,
    createIHDR(WIDTH, HEIGHT),
    createIDAT(pixels),
    createIEND()
  ];

  return Buffer.concat(parts);
}

/**
 * 初始化像素数组（透明背景）
 */
function initPixels() {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 0;     // R
    pixels[i + 1] = 0; // G
    pixels[i + 2] = 0; // B
    pixels[i + 3] = 0; // A (透明)
  }
  return pixels;
}

/**
 * 设置像素颜色
 */
function setPixel(pixels, x, y, color, alpha = 255) {
  if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
    const idx = (y * WIDTH + x) * 4;
    pixels[idx] = color.r;
    pixels[idx + 1] = color.g;
    pixels[idx + 2] = color.b;
    pixels[idx + 3] = alpha;
  }
}

/**
 * 绘制填充矩形
 */
function fillRect(pixels, x, y, width, height, color) {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      setPixel(pixels, x + dx, y + dy, color);
    }
  }
}

/**
 * 绘制三角形（用于屋顶）
 */
function fillTriangle(pixels, x1, y1, x2, y2, x3, y3, color) {
  // 找到边界框
  const minX = Math.max(0, Math.floor(Math.min(x1, x2, x3)));
  const maxX = Math.min(WIDTH - 1, Math.ceil(Math.max(x1, x2, x3)));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2, y3)));
  const maxY = Math.min(HEIGHT - 1, Math.ceil(Math.max(y1, y2, y3)));

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      // 使用重心坐标判断点是否在三角形内
      const d1 = sign(px, py, x1, y1, x2, y2);
      const d2 = sign(px, py, x2, y2, x3, y3);
      const d3 = sign(px, py, x3, y3, x1, y1);

      const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
      const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

      if (!(hasNeg && hasPos)) {
        setPixel(pixels, px, py, color);
      }
    }
  }
}

/**
 * 符号函数（用于三角形检测）
 */
function sign(px, py, x1, y1, x2, y2) {
  return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
}

/**
 * 绘制圆形（用于指示灯）
 */
function fillCircle(pixels, cx, cy, radius, color) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= radius) {
        setPixel(pixels, x, y, color);
      }
    }
  }
}

/**
 * 绘制圆角矩形
 */
function fillRoundedRect(pixels, x, y, width, height, radius, color) {
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      // 检查是否在圆角区域内
      let inRect = true;

      // 左上角
      if (px < x + radius && py < y + radius) {
        const dist = Math.sqrt((px - (x + radius)) ** 2 + (py - (y + radius)) ** 2);
        inRect = dist <= radius;
      }
      // 右上角
      else if (px > x + width - radius - 1 && py < y + radius) {
        const dist = Math.sqrt((px - (x + width - radius - 1)) ** 2 + (py - (y + radius)) ** 2);
        inRect = dist <= radius;
      }
      // 左下角
      else if (px < x + radius && py > y + height - radius - 1) {
        const dist = Math.sqrt((px - (x + radius)) ** 2 + (py - (y + height - radius - 1)) ** 2);
        inRect = dist <= radius;
      }
      // 右下角
      else if (px > x + width - radius - 1 && py > y + height - radius - 1) {
        const dist = Math.sqrt((px - (x + width - radius - 1)) ** 2 + (py - (y + height - radius - 1)) ** 2);
        inRect = dist <= radius;
      }

      if (inRect) {
        setPixel(pixels, px, py, color);
      }
    }
  }
}

/**
 * 生成首页图标（房子形状）
 */
function generateHomeIcon(color) {
  const pixels = initPixels();

  // 图标居中，整体大小约 45x45 像素
  const offsetX = (WIDTH - 45) / 2;
  const offsetY = (HEIGHT - 45) / 2;

  // 屋顶（三角形）
  fillTriangle(
    pixels,
    offsetX + 22.5, offsetY + 5,           // 顶点
    offsetX + 5, offsetY + 25,             // 左下
    offsetX + 40, offsetY + 25,            // 右下
    color
  );

  // 房子主体（正方形）
  fillRect(pixels, offsetX + 12, offsetY + 24, 21, 19, color);

  // 门（小矩形，用透明表示）
  fillRect(pixels, offsetX + 18, offsetY + 33, 9, 10, { r: 255, g: 255, b: 255 });

  return pixels;
}

/**
 * 生成设备图标（设备形状带指示灯）
 */
function generateDeviceIcon(color) {
  const pixels = initPixels();

  // 图标居中，整体大小约 40x50 像素
  const offsetX = (WIDTH - 40) / 2;
  const offsetY = (HEIGHT - 50) / 2;

  // 设备主体（圆角矩形）
  fillRoundedRect(pixels, offsetX + 5, offsetY + 8, 30, 36, 4, color);

  // 屏幕/显示区域（内部矩形，透明）
  fillRect(pixels, offsetX + 9, offsetY + 14, 22, 20, { r: 255, g: 255, b: 255 });

  // 指示灯（小圆点）
  fillCircle(pixels, offsetX + 30, offsetY + 40, 3, color);

  return pixels;
}

/**
 * 生成报告图标（柱状图形状）
 */
function generateReportIcon(color) {
  const pixels = initPixels();

  // 图标居中，整体大小约 45x40 像素
  const offsetX = (WIDTH - 45) / 2;
  const offsetY = (HEIGHT - 40) / 2;

  // 坐标轴基线
  fillRect(pixels, offsetX + 5, offsetY + 35, 38, 2, color);
  fillRect(pixels, offsetX + 5, offsetY + 5, 2, 32, color);

  // 4根柱子（从左到右，不同高度）
  const barWidth = 7;
  const gap = 3;
  const bars = [
    { x: offsetX + 10, h: 15 },   // 第一根柱子
    { x: offsetX + 20, h: 23 },   // 第二根柱子
    { x: offsetX + 30, h: 18 }    // 第三根柱子
  ];

  bars.forEach(bar => {
    fillRect(pixels, bar.x, offsetY + 35 - bar.h, barWidth, bar.h, color);
  });

  return pixels;
}

/**
 * 主函数：生成所有图标
 */
function main() {
  const outputDir = path.join(__dirname, 'miniprogram', 'src', 'images');

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 定义要生成的图标
  const icons = [
    { name: 'home.png', generator: generateHomeIcon, color: COLORS.gray },
    { name: 'home_active.png', generator: generateHomeIcon, color: COLORS.blue },
    { name: 'device.png', generator: generateDeviceIcon, color: COLORS.gray },
    { name: 'device_active.png', generator: generateDeviceIcon, color: COLORS.blue },
    { name: 'report.png', generator: generateReportIcon, color: COLORS.gray },
    { name: 'report_active.png', generator: generateReportIcon, color: COLORS.blue }
  ];

  console.log('开始生成 tabBar 图标...\n');

  icons.forEach(icon => {
    try {
      const pixels = icon.generator(icon.color);
      const pngData = generatePNG(pixels);
      const filePath = path.join(outputDir, icon.name);
      fs.writeFileSync(filePath, pngData);
      console.log(`✓ 已生成: ${icon.name} (${pngData.length} bytes)`);
    } catch (error) {
      console.error(`✗ 生成失败: ${icon.name}`, error.message);
    }
  });

  console.log('\n所有图标生成完成！');
}

// 执行主函数
main();
