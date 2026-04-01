// 图像对比核心算法
import type { PixelDiffResult, DiffRegion, DiffSeverity } from '@/types';

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
 * 连通区域检测算法（基于 BFS）
 */
function findConnectedRegions(
  diffMap: Uint8Array,
  width: number,
  height: number,
  minRegionSize: number = 10
): DiffRegion[] {
  const visited = new Uint8Array(diffMap.length);
  const regions: DiffRegion[] = [];
  let regionId = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (diffMap[idx] === 1 && visited[idx] === 0) {
        // 发现新的差异区域
        const region = bfsRegion(diffMap, visited, width, height, x, y, regionId);
        if (region.pixelCount >= minRegionSize) {
          regions.push({
            id: `region-${regionId}`,
            x: region.minX,
            y: region.minY,
            width: region.maxX - region.minX + 1,
            height: region.maxY - region.minY + 1,
            severity: calculateSeverity(region.pixelCount, width, height),
            diffPixels: region.pixelCount,
            affectedAreaPercentage: (region.pixelCount / (width * height)) * 100
          });
        }
        regionId++;
      }
    }
  }

  return regions;
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
 * 生成标注图（在原图上绘制红框）
 */
function generateAnnotatedImage(
  originalCanvas: HTMLCanvasElement,
  regions: DiffRegion[]
): string {
  const annotated = document.createElement('canvas');
  annotated.width = originalCanvas.width;
  annotated.height = originalCanvas.height;
  const ctx = annotated.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // 绘制原图
  ctx.drawImage(originalCanvas, 0, 0);

  // 绘制差异区域标注
  regions.forEach(region => {
    ctx.strokeStyle = getSeverityColor(region.severity);
    ctx.lineWidth = Math.max(2, Math.min(5, region.width / 50));
    ctx.strokeRect(region.x, region.y, region.width, region.height);

    // 添加半透明填充
    ctx.fillStyle = getSeverityColor(region.severity);
    ctx.globalAlpha = 0.2;
    ctx.fillRect(region.x, region.y, region.width, region.height);
    ctx.globalAlpha = 1.0;
  });

  return annotated.toDataURL('image/png');
}

/**
 * 根据严重程度获取颜色
 */
function getSeverityColor(severity: DiffSeverity): string {
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

    // 检测差异区域
    const minRegionSize = ignoreAntialiasing ? 50 : 10;
    const diffRegions = findConnectedRegions(diffMap, width, height, minRegionSize);

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
 * 生成带标注的对比图
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

    // 加载开发侧图片用于标注
    const devCanvas = await loadImageToCanvas(devImageSrc);

    // 生成标注图
    const annotatedImage = generateAnnotatedImage(devCanvas, diffResult.diffRegions);

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
