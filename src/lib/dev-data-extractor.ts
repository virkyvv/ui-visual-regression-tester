// 开发侧数据提取模块
import type { DevExtractedData, ColorValue, FontStyle, SpacingValue } from '@/types';

/**
 * 从图片中提取主色调
 */
export async function extractDominantColors(imageSrc: string, maxColors: number = 10): Promise<ColorValue[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // 缩放图片以提高性能
        const scale = Math.min(1, 200 / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colors = extractColorsFromImageData(imageData.data, maxColors);
        resolve(colors);
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageSrc;
  });
}

/**
 * 从图像数据中提取颜色（简单的颜色量化）
 */
function extractColorsFromImageData(data: Uint8ClampedArray, maxColors: number): ColorValue[] {
  const colorMap = new Map<string, number>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // 忽略透明像素
    if (a < 128) continue;

    // 量化颜色（减少精度以合并相似颜色）
    const qr = Math.round(r / 16) * 16;
    const qg = Math.round(g / 16) * 16;
    const qb = Math.round(b / 16) * 16;

    const colorKey = `#${qr.toString(16).padStart(2, '0')}${qg.toString(16).padStart(2, '0')}${qb.toString(16).padStart(2, '0')}`;
    colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
  }

  // 按出现频率排序并取前 maxColors 个
  const sortedColors = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors)
    .map(([color, _count], index) => ({
      id: `dev-color-${index}`,
      value: color,
      type: 'background' as const
    }));

  return sortedColors;
}

/**
 * 从图片中提取文本区域（简化版，实际需要 OCR）
 * 这里只是占位实现，实际项目中可以使用 Tesseract.js
 */
export async function extractTextFromImage(_imageSrc: string): Promise<FontStyle[]> {
  // 占位实现：返回空数组
  // 实际实现应该使用 OCR 库如 Tesseract.js
  console.warn('Text extraction not implemented. Requires OCR library like Tesseract.js');
  return [];
}

/**
 * 尝试使用 DOM 分析提取字体样式（如果是网页截图）
 */
export async function extractFontsFromDOM(iframe?: HTMLIFrameElement): Promise<FontStyle[]> {
  if (!iframe) {
    return [];
  }

  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      return [];
    }

    const fonts: FontStyle[] = [];
    const computedStyle = iframe.contentWindow?.getComputedStyle;
    if (!computedStyle) {
      return [];
    }

    // 提取所有文本元素的样式
    const textElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, button, a');
    const seenStyles = new Set<string>();

    textElements.forEach((element, index) => {
      const style = computedStyle(element);
      const styleKey = `${style.fontFamily}-${style.fontSize}-${style.fontWeight}`;

      if (!seenStyles.has(styleKey)) {
        seenStyles.add(styleKey);
        fonts.push({
          id: `dev-font-${index}`,
          nodeId: element.tagName.toLowerCase(),
          fontFamily: style.fontFamily.replace(/['"]/g, ''),
          fontSize: parseFloat(style.fontSize),
          fontWeight: parseInt(style.fontWeight),
          lineHeight: parseFloat(style.lineHeight),
          color: rgbToHex(style.color)
        });
      }
    });

    return fonts;
  } catch (error) {
    console.error('Failed to extract fonts from DOM:', error);
    return [];
  }
}

/**
 * RGB 字符串转 HEX
 */
function rgbToHex(rgb: string): string | undefined {
  const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!match) return undefined;

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * 从布局中提取间距（简化版）
 * 实际需要更复杂的布局分析
 */
export async function extractSpacingFromLayout(_imageSrc: string): Promise<SpacingValue[]> {
  // 占位实现：返回空数组
  // 实际实现需要图像识别和布局分析算法
  console.warn('Spacing extraction from image not implemented. Requires advanced layout analysis');
  return [];
}

/**
 * 从 DOM 中提取间距
 */
export async function extractSpacingFromDOM(iframe?: HTMLIFrameElement): Promise<SpacingValue[]> {
  if (!iframe) {
    return [];
  }

  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      return [];
    }

    const spacing: SpacingValue[] = [];
    const computedStyle = iframe.contentWindow?.getComputedStyle;
    if (!computedStyle) {
      return [];
    }

    // 提取常见元素的间距
    const elements = doc.querySelectorAll('[class*="container"], [class*="wrapper"], [class*="card"], section, nav, header, footer');

    elements.forEach((element, index) => {
      const style = computedStyle(element);
      const padding = {
        top: parseFloat(style.paddingTop),
        right: parseFloat(style.paddingRight),
        bottom: parseFloat(style.paddingBottom),
        left: parseFloat(style.paddingLeft)
      };

      const margin = {
        top: parseFloat(style.marginTop),
        right: parseFloat(style.marginRight),
        bottom: parseFloat(style.marginBottom),
        left: parseFloat(style.marginLeft)
      };

      // 只记录有值的间距
      const hasPadding = Object.values(padding).some(v => v > 0);
      const hasMargin = Object.values(margin).some(v => v > 0);

      if (hasPadding) {
        spacing.push({
          id: `dev-spacing-${index}`,
          nodeId: element.tagName.toLowerCase(),
          type: 'padding',
          value: padding
        });
      }

      if (hasMargin) {
        spacing.push({
          id: `dev-margin-${index}`,
          nodeId: element.tagName.toLowerCase(),
          type: 'margin',
          value: margin
        });
      }
    });

    return spacing;
  } catch (error) {
    console.error('Failed to extract spacing from DOM:', error);
    return [];
  }
}

/**
 * 完整的开发侧数据提取流程
 */
export async function extractDevData(
  imageSrc: string,
  iframe?: HTMLIFrameElement
): Promise<DevExtractedData> {
  try {
    const [colors, fontsFromDom, spacingFromDom] = await Promise.all([
      extractDominantColors(imageSrc),
      extractFontsFromDOM(iframe),
      extractSpacingFromDOM(iframe)
    ]);

    return {
      colors: colors.map(c => c.value),
      dominantColors: colors,
      fonts: fontsFromDom,
      spacing: spacingFromDom
    };
  } catch (error) {
    console.error('Failed to extract dev data:', error);
    throw error;
  }
}
