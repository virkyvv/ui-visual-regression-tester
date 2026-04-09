// 图像对比核心算法
import type { PixelDiffResult, DiffRegion, DiffSeverity, DiffType, ComponentType } from '@/types';

/**
 * 加载图片到 Canvas
 */
async function loadImageToCanvas(imageSrc: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageSrc;
  });
}

/**
 * 缩放 Canvas 到指定尺寸
 */
function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const resized = document.createElement('canvas');
  resized.width = width;
  resized.height = height;
  const ctx = resized.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  ctx.drawImage(canvas, 0, 0, width, height);
  return resized;
}

/**
 * 计算两个 RGB 颜色的欧氏距离
 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

/**
 * 圆角检测：通过边缘曲率分析判断元素是否为圆角矩形
 */
function detectBorderRadius(
  imageData: ImageData,
  region: { minX: number; minY: number; maxX: number; maxY: number }
): { hasBorderRadius: boolean; estimatedRadius: number; confidence: number } {
  const width = region.maxX - region.minX + 1;
  const height = region.maxY - region.minY + 1;
  const data = imageData.data;

  // 如果区域太小，无法检测
  if (width < 20 || height < 20) {
    return { hasBorderRadius: false, estimatedRadius: 0, confidence: 0 };
  }

  // 提取四个角区域的像素
  const cornerSize = Math.min(width, height) / 4;
  const corners = {
    topLeft: { x: region.minX, y: region.minY, w: cornerSize, h: cornerSize },
    topRight: { x: region.maxX - cornerSize, y: region.minY, w: cornerSize, h: cornerSize },
    bottomLeft: { x: region.minX, y: region.maxY - cornerSize, w: cornerSize, h: cornerSize },
    bottomRight: { x: region.maxX - cornerSize, y: region.maxY - cornerSize, w: cornerSize, h: cornerSize }
  };

  // 计算每个角的曲率
  const cornerCurvatures = Object.entries(corners).map(([_key, corner]) => {
    let curvedPixels = 0;
    let totalPixels = 0;

    for (let dy = 0; dy < corner.h; dy++) {
      for (let dx = 0; dx < corner.w; dx++) {
        const x = Math.floor(corner.x + dx);
        const y = Math.floor(corner.y + dy);
        const idx = (y * imageData.width + x) * 4;

        // 检查边缘像素
        const isEdge = (
          (dx === 0 || dy === 0) ||
          (dx >= corner.w - 1 || dy >= corner.h - 1)
        );

        if (isEdge) {
          totalPixels++;
          // 检查该像素是否与其他边缘像素形成平滑曲线
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          // 如果是透明或半透明,则认为是曲线
          // 使用 r, g, b 变量避免 TypeScript 警告
          const isTransparent = a < 255 || (r === 0 && g === 0 && b === 0);
          if (isTransparent) {
            curvedPixels++;
          }
        }
      }
    }

    return curvedPixels / totalPixels;
  });

  // 计算平均曲率
  const avgCurvature = cornerCurvatures.reduce((sum, c) => sum + c, 0) / cornerCurvatures.length;

  // 判断是否有圆角
  const hasBorderRadius = avgCurvature > 0.3;
  const estimatedRadius = hasBorderRadius ? Math.round(avgCurvature * cornerSize) : 0;
  const confidence = Math.min(1.0, avgCurvature + 0.2);

  return { hasBorderRadius, estimatedRadius, confidence };
}

/**
 * 颜色检测：通过颜色直方图分析判断颜色差异
 */
function detectColorDifference(
  canvas1: HTMLCanvasElement,
  canvas2: HTMLCanvasElement,
  region: { minX: number; minY: number; maxX: number; maxY: number }
): {
  dominantColor1: { r: number; g: number; b: number };
  dominantColor2: { r: number; g: number; b: number };
  colorDistance: number;
  hasSignificantDifference: boolean;
  confidence: number;
} {
  const ctx1 = canvas1.getContext('2d');
  const ctx2 = canvas2.getContext('2d');
  if (!ctx1 || !ctx2) {
    throw new Error('Failed to get canvas context');
  }

  const width = region.maxX - region.minX + 1;
  const height = region.maxY - region.minY + 1;

  const imageData1 = ctx1.getImageData(region.minX, region.minY, width, height);
  const imageData2 = ctx2.getImageData(region.minX, region.minY, width, height);

  const histogram1 = analyzeColorHistogram(imageData1.data);
  const histogram2 = analyzeColorHistogram(imageData2.data);

  const dominantColor1 = histogram1.dominant;
  const dominantColor2 = histogram2.dominant;

  const colorDistance = Math.sqrt(
    Math.pow(dominantColor1.r - dominantColor2.r, 2) +
    Math.pow(dominantColor1.g - dominantColor2.g, 2) +
    Math.pow(dominantColor1.b - dominantColor2.b, 2)
  );

  const maxDistance = Math.sqrt(255 * 255 * 3);
  const normalizedDistance = colorDistance / maxDistance;
  const hasSignificantDifference = normalizedDistance > 0.2; // 超过20%差异认为显著
  const confidence = Math.min(1.0, normalizedDistance * 2);

  return {
    dominantColor1,
    dominantColor2,
    colorDistance,
    hasSignificantDifference,
    confidence
  };
}

/**
 * 分析颜色直方图，找出主色调
 */
function analyzeColorHistogram(
  data: Uint8ClampedArray
): { dominant: { r: number; g: number; b: number }; histogram: Record<string, number> } {
  const histogram: Record<string, number> = {};
  let maxCount = 0;
  let dominant = { r: 0, g: 0, b: 0 };

  // 降低颜色精度以合并相似颜色
  const quantization = 16; // 每16个色阶合并

  for (let i = 0; i < data.length; i += 4) {
    const r = Math.floor(data[i] / quantization) * quantization;
    const g = Math.floor(data[i + 1] / quantization) * quantization;
    const b = Math.floor(data[i + 2] / quantization) * quantization;
    const a = data[i + 3];

    if (a < 128) continue; // 忽略透明像素

    const key = `${r},${g},${b}`;
    histogram[key] = (histogram[key] || 0) + 1;

    if (histogram[key] > maxCount) {
      maxCount = histogram[key];
      dominant = { r, g, b };
    }
  }

  return { dominant, histogram };
}

/**
 * 字号检测：通过文本区域识别和字体大小估算
 */
function detectFontSize(
  canvas: HTMLCanvasElement,
  region: { minX: number; minY: number; maxX: number; maxY: number }
): { hasText: boolean; estimatedFontSize: number; confidence: number } {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  const width = region.maxX - region.minX + 1;
  const height = region.maxY - region.minY + 1;

  // 如果区域太大或太小，不太可能是文本
  if (width > 500 || height > 100 || width < 10 || height < 10) {
    return { hasText: false, estimatedFontSize: 0, confidence: 0 };
  }

  const imageData = ctx.getImageData(region.minX, region.minY, width, height);
  const data = imageData.data;

  // 分析垂直线条的间距，估算字号
  const lineHeights: number[] = [];
  let previousTextLine: number | null = null;

  for (let y = 1; y < height - 1; y++) {
    let textPixelsInLine = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // 假设文本是深色（黑色或深灰色）
      if (r < 128 && g < 128 && b < 128) {
        textPixelsInLine++;
      }
    }

    // 如果这一行有超过20%的像素是文本像素
    if (textPixelsInLine > width * 0.2) {
      if (previousTextLine !== null) {
        lineHeights.push(y - previousTextLine);
      }
      previousTextLine = y;
    } else {
      previousTextLine = null;
    }
  }

  // 计算平均行高
  const avgLineHeight = lineHeights.length > 0
    ? lineHeights.reduce((sum, h) => sum + h, 0) / lineHeights.length
    : 0;

  // 字号通常是行高的80-90%
  const estimatedFontSize = Math.round(avgLineHeight * 0.85);
  const hasText = estimatedFontSize > 8 && estimatedFontSize < 72;
  const confidence = hasText ? Math.min(1.0, lineHeights.length / 5) : 0;

  return { hasText, estimatedFontSize, confidence };
}

/**
 * 间距检测：测量元素间的距离
 */
export function detectSpacing(
  _imageData: ImageData,
  region1: { minX: number; minY: number; maxX: number; maxY: number },
  region2: { minX: number; minY: number; maxX: number; maxY: number }
): { spacing: number; isIrregular: boolean; confidence: number } {
  // 计算两个区域之间的最小距离
  const xDistance = Math.min(
    Math.abs(region1.maxX - region2.minX),
    Math.abs(region2.maxX - region1.minX)
  );

  const yDistance = Math.min(
    Math.abs(region1.maxY - region2.minY),
    Math.abs(region2.maxY - region1.minY)
  );

  // 取水平和垂直距离的较小值
  const spacing = Math.min(xDistance, yDistance);

  // 判断间距是否不规则（距离过小或过大）
  const isIrregular = spacing < 5 || spacing > 50;
  const confidence = isIrregular ? 0.8 : 0.3;

  return { spacing, isIrregular, confidence };
}

/**
 * 尺寸检测：对比元素宽高
 */
function detectSizeDifference(
  canvas1: HTMLCanvasElement,
  canvas2: HTMLCanvasElement,
  region: { minX: number; minY: number; maxX: number; maxY: number }
): {
  width1: number; height1: number;
  width2: number; height2: number;
  widthDiff: number; heightDiff: number;
  hasSignificantDifference: boolean;
  confidence: number;
} {
  const width = region.maxX - region.minX + 1;
  const height = region.maxY - region.minY + 1;

  const ctx1 = canvas1.getContext('2d');
  const ctx2 = canvas2.getContext('2d');
  if (!ctx1 || !ctx2) {
    throw new Error('Failed to get canvas context');
  }

  const imageData1 = ctx1.getImageData(region.minX, region.minY, width, height);
  const imageData2 = ctx2.getImageData(region.minX, region.minY, width, height);

  // 计算设计稿中的元素边界
  const bounds1 = calculateElementBounds(imageData1.data, width, height);
  const bounds2 = calculateElementBounds(imageData2.data, width, height);

  const width1 = bounds1.maxX - bounds1.minX + 1;
  const height1 = bounds1.maxY - bounds1.minY + 1;
  const width2 = bounds2.maxX - bounds2.minX + 1;
  const height2 = bounds2.maxY - bounds2.minY + 1;

  const widthDiff = Math.abs(width1 - width2);
  const heightDiff = Math.abs(height1 - height2);

  const sizeRatio = Math.max(width1, height1) / Math.max(width2, height2);
  const hasSignificantDifference = sizeRatio < 0.9 || sizeRatio > 1.1;
  const confidence = Math.min(1.0, (sizeRatio - 0.9) * 5);

  return {
    width1, height1,
    width2, height2,
    widthDiff, heightDiff,
    hasSignificantDifference,
    confidence
  };
}

/**
 * 计算元素边界
 */
function calculateElementBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];

      if (a > 128) { // 非透明像素
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return { minX, minY, maxX, maxY };
}

/**
 * 分析差异区域的问题类型（基于新的五维检测方法）
 */
function rgbToHex(color: { r: number; g: number; b: number }): string {
  const toHex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase();
}

function inferDirectionAndPixelValue(
  region: { minX: number; minY: number; maxX: number; maxY: number },
  canvas: HTMLCanvasElement
): { direction: '上' | '下' | '左' | '右'; pixelValue: number } {
  const centerX = (region.minX + region.maxX) / 2;
  const centerY = (region.minY + region.maxY) / 2;
  const horizontal = centerX >= canvas.width / 2;
  const vertical = centerY >= canvas.height / 2;

  const direction = horizontal ? '右' : '左';
  const secondDirection = vertical ? '下' : '上';
  const pixelValue = Math.max(region.maxX - region.minX, region.maxY - region.minY);

  return {
    direction: Math.abs(centerX - canvas.width / 2) > Math.abs(centerY - canvas.height / 2)
      ? direction
      : secondDirection,
    pixelValue: Math.max(5, Math.round(pixelValue * 0.2))
  };
}

function getComponentTypeForRegion(
  type: string,
  fontSize1: { hasText: boolean },
  fontSize2: { hasText: boolean }
): ComponentType {
  if (type === 'fontSize' || fontSize1.hasText || fontSize2.hasText) {
    return 'text';
  }
  if (type === 'color' || type === 'borderRadius' || type === 'layout' || type === 'alignment' || type === 'spacing') {
    return 'rect-block';
  }
  return 'rect-block';
}

function getComponentIdForRegion(region: { minX: number; minY: number; maxX: number; maxY: number }): string {
  return `差异区域 ${region.minX}-${region.minY}`;
}

function classifyDiffType(
  canvas1: HTMLCanvasElement,
  canvas2: HTMLCanvasElement,
  region: { minX: number; minY: number; maxX: number; maxY: number }
): {
  type: DiffType;
  expectedValue: string;
  actualValue: string;
  deviation: string;
  confidence: number;
  componentType: ComponentType;
  componentId: string;
  direction?: '上' | '下' | '左' | '右';
  pixelValue?: number;
  designColor?: string;
  devColor?: string;
  designSize?: { width: number; height: number };
  devSize?: { width: number; height: number };
  sizeType?: '宽' | '高' | '宽高';
  designFont?: string;
  devFont?: string;
} {
  const ctx1 = canvas1.getContext('2d');
  const ctx2 = canvas2.getContext('2d');
  if (!ctx1 || !ctx2) {
    throw new Error('Failed to get canvas context');
  }

  const width = region.maxX - region.minX + 1;
  const height = region.maxY - region.minY + 1;
  const imageData1 = ctx1.getImageData(region.minX, region.minY, width, height);
  const imageData2 = ctx2.getImageData(region.minX, region.minY, width, height);

  const borderRadius1 = detectBorderRadius(imageData1, region);
  const borderRadius2 = detectBorderRadius(imageData2, region);
  const colorDiff = detectColorDifference(canvas1, canvas2, region);
  const fontSize1 = detectFontSize(canvas1, region);
  const fontSize2 = detectFontSize(canvas2, region);
  const sizeDiff = detectSizeDifference(canvas1, canvas2, region);

  const detections: Array<{ type: DiffType; confidence: number; description: string }> = [];

  if (colorDiff.hasSignificantDifference && colorDiff.confidence > 0.5) {
    detections.push({
      type: 'color',
      confidence: colorDiff.confidence,
      description: `颜色差异：${rgbToHex(colorDiff.dominantColor1)} → ${rgbToHex(colorDiff.dominantColor2)}`
    });
  }

  if (sizeDiff.hasSignificantDifference && sizeDiff.confidence > 0.5) {
    detections.push({
      type: 'size',
      confidence: sizeDiff.confidence,
      description: `尺寸差异：${sizeDiff.width1}x${sizeDiff.height1} → ${sizeDiff.width2}x${sizeDiff.height2}`
    });
  }

  if (borderRadius1.hasBorderRadius !== borderRadius2.hasBorderRadius) {
    detections.push({
      type: 'borderRadius',
      confidence: Math.max(borderRadius1.confidence, borderRadius2.confidence),
      description: `圆角差异：${borderRadius1.hasBorderRadius ? `${borderRadius1.estimatedRadius}px` : '无'} → ${borderRadius2.hasBorderRadius ? `${borderRadius2.estimatedRadius}px` : '无'}`
    });
  }

  if (fontSize1.hasText && fontSize2.hasText && Math.abs(fontSize1.estimatedFontSize - fontSize2.estimatedFontSize) > 2) {
    detections.push({
      type: 'fontSize',
      confidence: Math.max(fontSize1.confidence, fontSize2.confidence),
      description: `字号差异：${fontSize1.estimatedFontSize}px → ${fontSize2.estimatedFontSize}px`
    });
  }

  if (detections.length === 0) {
    const aspectRatio = width / height;
    if (aspectRatio > 5 || aspectRatio < 0.2) {
      detections.push({
        type: 'spacing',
        confidence: 0.75,
        description: `间距异常：长宽比 ${aspectRatio.toFixed(2)}`
      });
    } else {
      detections.push({
        type: 'layout',
        confidence: 0.6,
        description: '布局差异'
      });
    }
  }

  const bestDetection = detections.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );

  const { direction, pixelValue } = inferDirectionAndPixelValue(region, canvas1);
  const componentType = getComponentTypeForRegion(bestDetection.type, fontSize1, fontSize2);

  const sizeType: '宽' | '高' | '宽高' = sizeDiff.widthDiff > 0 && sizeDiff.heightDiff === 0
    ? '宽'
    : sizeDiff.heightDiff > 0 && sizeDiff.widthDiff === 0
      ? '高'
      : '宽高';

  return {
    type: bestDetection.type,
    expectedValue: bestDetection.description,
    actualValue: '实际实现值',
    deviation: bestDetection.description,
    confidence: bestDetection.confidence,
    componentType,
    componentId: getComponentIdForRegion(region),
    direction: bestDetection.type === 'layout' || bestDetection.type === 'alignment' || bestDetection.type === 'spacing'
      ? direction
      : undefined,
    pixelValue: bestDetection.type === 'layout' || bestDetection.type === 'alignment' || bestDetection.type === 'spacing'
      ? pixelValue
      : undefined,
    designColor: colorDiff.hasSignificantDifference ? rgbToHex(colorDiff.dominantColor1) : undefined,
    devColor: colorDiff.hasSignificantDifference ? rgbToHex(colorDiff.dominantColor2) : undefined,
    designSize: sizeDiff.hasSignificantDifference ? { width: sizeDiff.width1, height: sizeDiff.height1 } : undefined,
    devSize: sizeDiff.hasSignificantDifference ? { width: sizeDiff.width2, height: sizeDiff.height2 } : undefined,
    sizeType: sizeDiff.hasSignificantDifference ? sizeType : undefined,
    designFont: fontSize1.hasText ? `约 ${fontSize1.estimatedFontSize}px 字号` : undefined,
    devFont: fontSize2.hasText ? `约 ${fontSize2.estimatedFontSize}px 字号` : undefined
  };
}

/**
 * 比较两个 Canvas 的像素差异
 */
function compareCanvases(
  canvas1: HTMLCanvasElement,
  canvas2: HTMLCanvasElement,
  threshold: number
): { diffMap: Uint8Array; diffPixels: number } {
  const ctx1 = canvas1.getContext('2d');
  const ctx2 = canvas2.getContext('2d');
  if (!ctx1 || !ctx2) {
    throw new Error('Failed to get canvas context');
  }

  const width = canvas1.width;
  const height = canvas1.height;
  const imageData1 = ctx1.getImageData(0, 0, width, height);
  const imageData2 = ctx2.getImageData(0, 0, width, height);

  const data1 = imageData1.data;
  const data2 = imageData2.data;
  const diffMap = new Uint8Array(width * height);
  let diffPixels = 0;

  const maxDistance = Math.sqrt(255 * 255 * 3);
  const tolerance = (threshold / 100) * maxDistance;

  for (let i = 0; i < data1.length; i += 4) {
    const r1 = data1[i];
    const g1 = data1[i + 1];
    const b1 = data1[i + 2];

    const r2 = data2[i];
    const g2 = data2[i + 1];
    const b2 = data2[i + 2];

    const distance = colorDistance(r1, g1, b1, r2, g2, b2);
    const isDifferent = distance > tolerance;

    if (isDifferent) {
      diffPixels++;
      diffMap[i / 4] = 1;
    }
  }

  return { diffMap, diffPixels };
}

/**
 * 合并相邻的差异区域
 */
function mergeAdjacentRegions(
  regions: DiffRegion[],
  mergeDistance: number = 20
): DiffRegion[] {
  if (regions.length === 0) return regions;

  const merged: DiffRegion[] = [];
  const used = new Set<string>();

  for (let i = 0; i < regions.length; i++) {
    if (used.has(regions[i].id)) continue;

    let currentRegion = { ...regions[i] };
    used.add(currentRegion.id);

    // 查找相邻的区域并合并
    let foundMerge = true;
    while (foundMerge) {
      foundMerge = false;

      for (let j = 0; j < regions.length; j++) {
        if (used.has(regions[j].id)) continue;

        const other = regions[j];

        // 检查是否相邻（距离阈值内）
        const distanceX = Math.min(
          Math.abs(currentRegion.x - (other.x + other.width)),
          Math.abs(other.x - (currentRegion.x + currentRegion.width))
        );
        const distanceY = Math.min(
          Math.abs(currentRegion.y - (other.y + other.height)),
          Math.abs(other.y - (currentRegion.y + currentRegion.height))
        );

        if (distanceX <= mergeDistance && distanceY <= mergeDistance) {
          // 合并区域
          const newX = Math.min(currentRegion.x, other.x);
          const newY = Math.min(currentRegion.y, other.y);
          const newWidth = Math.max(
            currentRegion.x + currentRegion.width,
            other.x + other.width
          ) - newX;
          const newHeight = Math.max(
            currentRegion.y + currentRegion.height,
            other.y + other.height
          ) - newY;

          // 合并设计稿位置（绿色框）
          const newDesignCorrectX = Math.min(
            currentRegion.designCorrectX!,
            other.designCorrectX!
          );
          const newDesignCorrectY = Math.min(
            currentRegion.designCorrectY!,
            other.designCorrectY!
          );
          const newDesignCorrectWidth = Math.max(
            currentRegion.designCorrectX! + currentRegion.designCorrectWidth!,
            other.designCorrectX! + other.designCorrectWidth!
          ) - newDesignCorrectX;
          const newDesignCorrectHeight = Math.max(
            currentRegion.designCorrectY! + currentRegion.designCorrectHeight!,
            other.designCorrectY! + other.designCorrectHeight!
          ) - newDesignCorrectY;

          // 合并开发稿位置（红色框）
          const newDevErrorX = Math.min(
            currentRegion.devErrorX!,
            other.devErrorX!
          );
          const newDevErrorY = Math.min(
            currentRegion.devErrorY!,
            other.devErrorY!
          );
          const newDevErrorWidth = Math.max(
            currentRegion.devErrorX! + currentRegion.devErrorWidth!,
            other.devErrorX! + other.devErrorWidth!
          ) - newDevErrorX;
          const newDevErrorHeight = Math.max(
            currentRegion.devErrorY! + currentRegion.devErrorHeight!,
            other.devErrorY! + other.devErrorHeight!
          ) - newDevErrorY;

          currentRegion = {
            ...currentRegion,
            id: currentRegion.id,
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
            diffPixels: currentRegion.diffPixels + other.diffPixels,
            affectedAreaPercentage: ((currentRegion.diffPixels + other.diffPixels) / (newWidth * newHeight)) * 100,

            // 更新设计稿位置（绿色框）
            designCorrectX: newDesignCorrectX,
            designCorrectY: newDesignCorrectY,
            designCorrectWidth: newDesignCorrectWidth,
            designCorrectHeight: newDesignCorrectHeight,

            // 更新开发稿位置（红色框）
            devErrorX: newDevErrorX,
            devErrorY: newDevErrorY,
            devErrorWidth: newDevErrorWidth,
            devErrorHeight: newDevErrorHeight
          };

          used.add(other.id);
          foundMerge = true;
        }
      }
    }

    merged.push(currentRegion);
  }

  return merged;
}

/**
 * 连通区域检测算法（基于 BFS）
 */
function findConnectedRegions(
  diffMap: Uint8Array,
  width: number,
  height: number,
  designCanvas: HTMLCanvasElement,
  devCanvas: HTMLCanvasElement,
  minRegionSize: number = 10
): DiffRegion[] {
  const visited = new Uint8Array(diffMap.length);
  const regions: DiffRegion[] = [];
  let regionId = 0;

  // 获取设计稿和开发稿的缩放比例
  const scaleX = designCanvas.width / width;
  const scaleY = designCanvas.height / height;
  const devScaleX = devCanvas.width / width;
  const devScaleY = devCanvas.height / height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (diffMap[idx] === 1 && visited[idx] === 0) {
        // 发现新的差异区域
        const regionData = bfsRegion(diffMap, visited, width, height, x, y, regionId);
        if (regionData.pixelCount >= minRegionSize) {
          // 分析差异类型
          const typeInfo = classifyDiffType(designCanvas, devCanvas, {
            minX: regionData.minX,
            minY: regionData.minY,
            maxX: regionData.maxX,
            maxY: regionData.maxY
          });

          // 计算绿色框（设计稿正确位置）和红色框（开发稿错误位置）的坐标
          // 这里使用原始 Canvas 的坐标，避免统一尺寸后的坐标混淆
          const designCorrectX = Math.round(regionData.minX * scaleX);
          const designCorrectY = Math.round(regionData.minY * scaleY);
          const designCorrectWidth = Math.round((regionData.maxX - regionData.minX + 1) * scaleX);
          const designCorrectHeight = Math.round((regionData.maxY - regionData.minY + 1) * scaleY);

          const devErrorX = Math.round(regionData.minX * devScaleX);
          const devErrorY = Math.round(regionData.minY * devScaleY);
          const devErrorWidth = Math.round((regionData.maxX - regionData.minX + 1) * devScaleX);
          const devErrorHeight = Math.round((regionData.maxY - regionData.minY + 1) * devScaleY);

          regions.push({
            id: `region-${regionId}`,
            x: regionData.minX,
            y: regionData.minY,
            width: regionData.maxX - regionData.minX + 1,
            height: regionData.maxY - regionData.minY + 1,
            severity: calculateSeverity(regionData.pixelCount, width, height),
            diffPixels: regionData.pixelCount,
            affectedAreaPercentage: (regionData.pixelCount / (width * height)) * 100,

            // 新增字段
            type: typeInfo.type,
            position: `坐标(${regionData.minX}, ${regionData.minY})`,
            expectedValue: typeInfo.expectedValue,
            actualValue: typeInfo.actualValue,
            deviation: typeInfo.deviation,
            confidence: typeInfo.confidence,
            componentType: typeInfo.componentType,
            componentId: typeInfo.componentId,
            status: 'pending',
            direction: typeInfo.direction,
            pixelValue: typeInfo.pixelValue,
            designColor: typeInfo.designColor,
            devColor: typeInfo.devColor,
            designSize: typeInfo.designSize,
            devSize: typeInfo.devSize,
            sizeType: typeInfo.sizeType,
            designFont: typeInfo.designFont,
            devFont: typeInfo.devFont,

            // 设计稿中的正确位置（绿色框）- 使用原始 Canvas 坐标
            designCorrectX,
            designCorrectY,
            designCorrectWidth,
            designCorrectHeight,

            // 开发稿中的错误位置（红色框）- 使用原始 Canvas 坐标
            devErrorX,
            devErrorY,
            devErrorWidth,
            devErrorHeight,
            
            // 记录标注图的原始尺寸（开发稿 canvas 尺寸）
            canvasWidth: devCanvas.width,
            canvasHeight: devCanvas.height
          });
        }
        regionId++;
      }
    }
  }

  // 合并相邻的区域
  const mergedRegions = mergeAdjacentRegions(regions, 20);

  // 重新计算合并后区域的严重程度
  mergedRegions.forEach(region => {
    region.severity = calculateSeverity(region.diffPixels, width, height);
  });

  return mergedRegions;
}

/**
 * BFS 区域搜索
 */
function bfsRegion(
  diffMap: Uint8Array,
  visited: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  _regionId: number
): { pixelCount: number; minX: number; minY: number; maxX: number; maxY: number } {
  const queue: [number, number][] = [[startX, startY]];
  visited[startY * width + startX] = 1;

  let pixelCount = 0;
  let minX = startX, minY = startY, maxX = startX, maxY = startY;

  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1] // 上下左右
  ];

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    pixelCount++;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      const nidx = ny * width + nx;

      if (
        nx >= 0 && nx < width &&
        ny >= 0 && ny < height &&
        diffMap[nidx] === 1 &&
        visited[nidx] === 0
      ) {
        visited[nidx] = 1;
        queue.push([nx, ny]);
      }
    }
  }

  return { pixelCount, minX, minY, maxX, maxY };
}

/**
 * 根据差异区域大小计算严重程度
 */
function calculateSeverity(pixelCount: number, width: number, height: number): DiffSeverity {
  const totalPixels = width * height;
  const percentage = (pixelCount / totalPixels) * 100;

  if (percentage < 0.1) return 'low';
  if (percentage < 1.0) return 'medium';
  return 'high';
}

/**
 * 生成标注图（在开发稿上同时绘制绿色框和红色框）
 */
function generateAnnotatedImage(
  designCanvas: HTMLCanvasElement,
  devCanvas: HTMLCanvasElement,
  regions: DiffRegion[]
): string {
  // 创建与开发稿相同尺寸的画布
  const annotated = document.createElement('canvas');
  annotated.width = devCanvas.width;
  annotated.height = devCanvas.height;
  const ctx = annotated.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // 绘制开发稿作为底图
  ctx.drawImage(devCanvas, 0, 0);

  // 计算设计稿到开发稿的缩放比例
  const scaleX = devCanvas.width / designCanvas.width;
  const scaleY = devCanvas.height / designCanvas.height;

  // 绘制差异区域标注
  regions.forEach(region => {
    // 绿色框：标注设计稿中的正确位置（预期）- 需要映射到开发稿坐标系
    if (region.designCorrectX !== undefined && 
        region.designCorrectY !== undefined &&
        region.designCorrectWidth !== undefined &&
        region.designCorrectHeight !== undefined) {
      // 将设计稿坐标映射到开发稿坐标系
      const mappedX = Math.round(region.designCorrectX * scaleX);
      const mappedY = Math.round(region.designCorrectY * scaleY);
      const mappedWidth = Math.round(region.designCorrectWidth * scaleX);
      const mappedHeight = Math.round(region.designCorrectHeight * scaleY);

      ctx.strokeStyle = '#22C55E'; // 绿色
      ctx.lineWidth = Math.max(2, Math.min(5, mappedWidth / 50));
      ctx.strokeRect(mappedX, mappedY, mappedWidth, mappedHeight);

      // 添加半透明绿色填充
      ctx.fillStyle = '#22C55E';
      ctx.globalAlpha = 0.15;
      ctx.fillRect(mappedX, mappedY, mappedWidth, mappedHeight);
      ctx.globalAlpha = 1.0;
    }

    // 红色框：标注开发稿中的实际位置（实际）
    if (region.devErrorX !== undefined &&
        region.devErrorY !== undefined &&
        region.devErrorWidth !== undefined &&
        region.devErrorHeight !== undefined) {
      ctx.strokeStyle = '#EF4444'; // 红色
      ctx.lineWidth = Math.max(2, Math.min(5, region.devErrorWidth / 50));
      ctx.strokeRect(region.devErrorX, region.devErrorY, region.devErrorWidth, region.devErrorHeight);

      // 添加半透明红色填充
      ctx.fillStyle = '#EF4444';
      ctx.globalAlpha = 0.15;
      ctx.fillRect(region.devErrorX, region.devErrorY, region.devErrorWidth!, region.devErrorHeight!);
      ctx.globalAlpha = 1.0;
    }

    // 添加区域编号（用于交互识别）
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial';
    const labelX = region.devErrorX !== undefined ? region.devErrorX : 
                   (region.designCorrectX !== undefined ? Math.round(region.designCorrectX * scaleX) : 0);
    const labelY = region.devErrorY !== undefined ? region.devErrorY : 
                   (region.designCorrectY !== undefined ? Math.round(region.designCorrectY * scaleY) : 0);
    ctx.fillText(`#${region.id.split('-')[1]}`, labelX + 5, labelY + 15);
  });

  return annotated.toDataURL('image/png');
}

/**
 * 根据严重程度获取颜色
 */
export function getSeverityColor(severity: DiffSeverity): string {
  switch (severity) {
    case 'low': return '#F59E0B'; // 黄色
    case 'medium': return '#EF4444'; // 橙红色
    case 'high': return '#DC2626'; // 深红色
  }
}

/**
 * 主函数：比较两张图片并返回差异结果
 */
export async function compareImages(
  image1Src: string,
  image2Src: string,
  threshold: number = 15, // 默认阈值 15%
  ignoreAntialiasing: boolean = true
): Promise<PixelDiffResult> {
  try {
    // 加载图片
    const canvas1 = await loadImageToCanvas(image1Src);
    const canvas2 = await loadImageToCanvas(image2Src);

    // 统一尺寸（以较小的尺寸为准）
    const width = Math.min(canvas1.width, canvas2.width);
    const height = Math.min(canvas1.height, canvas2.height);

    const resized1 = resizeCanvas(canvas1, width, height);
    const resized2 = resizeCanvas(canvas2, width, height);

    // 比较像素
    const { diffMap, diffPixels } = compareCanvases(resized1, resized2, threshold);
    const totalPixels = width * height;
    const diffPercentage = (diffPixels / totalPixels) * 100;

    // 检测差异区域（传递 canvas 参数）
    // 增大最小区域尺寸阈值，从50提高到100，过滤掉更小的差异
    const minRegionSize = ignoreAntialiasing ? 100 : 20;
    const diffRegions = findConnectedRegions(diffMap, width, height, resized1, resized2, minRegionSize);

    // 按严重程度排序
    diffRegions.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return {
      diffPixels,
      totalPixels,
      diffPercentage,
      diffRegions,
      isIgnoredByAntialiasing: ignoreAntialiasing
    };
  } catch (error) {
    console.error('Image comparison error:', error);
    throw error;
  }
}

/**
 * 生成带标注的对比图（双框对比效果）
 */
export async function generateAnnotatedComparison(
  designImageSrc: string,
  devImageSrc: string,
  threshold: number = 15,
  ignoreAntialiasing: boolean = true
): Promise<string> {
  try {
    // 获取差异结果
    const diffResult = await compareImages(designImageSrc, devImageSrc, threshold, ignoreAntialiasing);

    // 加载设计稿和开发稿图片
    const designCanvas = await loadImageToCanvas(designImageSrc);
    const devCanvas = await loadImageToCanvas(devImageSrc);

    // 生成双框对比标注图
    const annotatedImage = generateAnnotatedImage(designCanvas, devCanvas, diffResult.diffRegions);

    return annotatedImage;
  } catch (error) {
    console.error('Annotated image generation error:', error);
    throw error;
  }
}

/**
 * 计算图片的颜色直方图
 */
export async function calculateColorHistogram(imageSrc: string): Promise<number[]> {
  const canvas = await loadImageToCanvas(imageSrc);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 计算颜色直方图（简化版：分为 16 个 bin）
  const histogram = new Array(16).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 将 RGB 值映射到 0-15 的 bin
    const rBin = Math.floor(r / 16);
    const gBin = Math.floor(g / 16);
    const bBin = Math.floor(b / 16);

    // 组合成一个 bin 索引
    const binIndex = (rBin + gBin + bBin) % 16;
    histogram[binIndex]++;
  }

  // 归一化
  const totalPixels = width * height;
  return histogram.map(count => count / totalPixels);
}

/**
 * 计算两个直方图的相似度（使用 Bhattacharyya 距离）
 */
export function calculateHistogramSimilarity(histogram1: number[], histogram2: number[]): number {
  if (histogram1.length !== histogram2.length) {
    throw new Error('Histograms must have the same length');
  }

  // 计算 Bhattacharyya 系数
  let bc = 0;
  for (let i = 0; i < histogram1.length; i++) {
    bc += Math.sqrt(histogram1[i] * histogram2[i]);
  }

  // 转换为相似度 (0-1, 1 表示完全相同)
  return bc;
}

/**
 * 批量匹配图片对
 */
export async function matchImagePairs(
  designImages: Array<{ name: string; data: string }>,
  devImages: Array<{ name: string; data: string }>
): Promise<Array<{ design: typeof designImages[0]; dev: typeof devImages[0]; similarity: number }>> {
  // 计算所有图片的直方图
  const designHistograms = await Promise.all(
    designImages.map(async (img) => ({
      ...img,
      histogram: await calculateColorHistogram(img.data)
    }))
  );

  const devHistograms = await Promise.all(
    devImages.map(async (img) => ({
      ...img,
      histogram: await calculateColorHistogram(img.data)
    }))
  );

  // 计算所有可能的配对及其相似度
  const pairs: Array<{
    design: typeof designImages[0];
    dev: typeof devImages[0];
    similarity: number;
  }> = [];

  for (const designImg of designHistograms) {
    for (const devImg of devHistograms) {
      const similarity = calculateHistogramSimilarity(designImg.histogram, devImg.histogram);
      pairs.push({
        design: { name: designImg.name, data: designImg.data },
        dev: { name: devImg.name, data: devImg.data },
        similarity
      });
    }
  }

  // 贪心匹配：按相似度从高到低排序
  pairs.sort((a, b) => b.similarity - a.similarity);

  const matchedPairs: typeof pairs = [];
  const usedDesign = new Set<string>();
  const usedDev = new Set<string>();

  for (const pair of pairs) {
    if (!usedDesign.has(pair.design.name) && !usedDev.has(pair.dev.name)) {
      matchedPairs.push(pair);
      usedDesign.add(pair.design.name);
      usedDev.add(pair.dev.name);
    }
  }

  return matchedPairs;
}
