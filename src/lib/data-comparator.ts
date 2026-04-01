// 数据级对比逻辑
import type { DataDiffResult, ColorDiff, FontDiff, SpacingDiff, ExtractedDesignData, DevExtractedData, ColorValue, FontStyle, SpacingValue } from '@/types';

/**
 * 计算两个颜色的色差（使用 RGB 欧氏距离）
 */
function calculateColorDiff(color1: string, color2: string): number {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  if (!c1 || !c2) return 100; // 无法解析的颜色视为最大差异

  const maxDistance = Math.sqrt(255 * 255 * 3);
  const distance = Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );

  return (distance / maxDistance) * 100;
}

/**
 * HEX 转 RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * 对比颜色数据
 */
export function compareColors(
  designColors: ColorValue[],
  devColors: ColorValue[],
  tolerance: number = 10
): ColorDiff[] {
  const diffs: ColorDiff[] = [];

  designColors.forEach(designColor => {
    // 在开发侧寻找最接近的颜色
    let bestMatch: ColorValue | undefined;
    let minDiff = Infinity;

    devColors.forEach(devColor => {
      const diff = calculateColorDiff(designColor.value, devColor.value);
      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = devColor;
      }
    });

    const severity = minDiff <= tolerance ? 'low' : minDiff <= tolerance * 2 ? 'medium' : 'high';

    diffs.push({
      id: designColor.id,
      expected: designColor.value,
      actual: bestMatch?.value,
      diffValue: minDiff,
      status: minDiff <= tolerance ? 'match' : 'mismatch',
      severity,
      nodeId: designColor.nodeId
    });
  });

  // 找出开发侧有但设计稿没有的颜色
  devColors.forEach(devColor => {
    const exists = diffs.some(diff => diff.actual === devColor.value);
    if (!exists) {
      diffs.push({
        id: `extra-${devColor.id}`,
        expected: '',
        actual: devColor.value,
        status: 'mismatch',
        severity: 'low'
      });
    }
  });

  return diffs;
}

/**
 * 对比字体样式
 */
export function compareFonts(
  designFonts: FontStyle[],
  devFonts: Partial<FontStyle>[],
  tolerance: { fontSize: number; lineHeight: number } = { fontSize: 1, lineHeight: 2 }
): FontDiff[] {
  const diffs: FontDiff[] = [];

  designFonts.forEach(designFont => {
    // 在开发侧寻找匹配的字体
    let bestMatch: Partial<FontStyle> | undefined;
    let minDifferences: FontDiff['differences'] = [];
    let minSeverity: 'match' | 'partial' | 'mismatch' = 'mismatch';

    devFonts.forEach(devFont => {
      const differences: FontDiff['differences'] = [];
      let severity: 'match' | 'partial' | 'mismatch' = 'match';

      // 对比字体大小
      if (designFont.fontSize !== undefined && devFont.fontSize !== undefined) {
        const diff = Math.abs(designFont.fontSize - devFont.fontSize);
        if (diff > tolerance.fontSize) {
          severity = 'partial';
          differences.push({
            property: 'fontSize',
            expected: designFont.fontSize,
            actual: devFont.fontSize,
            tolerance: tolerance.fontSize
          });
        }
      }

      // 对比字重
      if (designFont.fontWeight !== undefined && devFont.fontWeight !== undefined) {
        const diff = Math.abs(designFont.fontWeight - devFont.fontWeight);
        if (diff > 50) { // 字重差异超过 50 视为不匹配
          severity = 'partial';
          differences.push({
            property: 'fontWeight',
            expected: designFont.fontWeight,
            actual: devFont.fontWeight
          });
        }
      }

      // 对比行高
      if (designFont.lineHeight !== undefined && devFont.lineHeight !== undefined) {
        const diff = Math.abs(designFont.lineHeight - devFont.lineHeight);
        if (diff > tolerance.lineHeight) {
          severity = 'partial';
          differences.push({
            property: 'lineHeight',
            expected: designFont.lineHeight,
            actual: devFont.lineHeight,
            tolerance: tolerance.lineHeight
          });
        }
      }

      // 选择差异最小的匹配
      if (differences.length < minDifferences.length || minDifferences.length === 0) {
        bestMatch = devFont;
        minDifferences = differences;
        minSeverity = severity;
      }
    });

    const overallSeverity: import('@/types').DiffSeverity = minDifferences.length === 0 ? 'low' :
                           minDifferences.length <= 1 ? 'low' :
                           minDifferences.length <= 2 ? 'medium' : 'high';

    diffs.push({
      id: designFont.id,
      nodeId: designFont.nodeId,
      expected: designFont,
      actual: bestMatch,
      differences: minDifferences,
      status: minSeverity,
      severity: overallSeverity
    });
  });

  return diffs;
}

/**
 * 对比间距数据
 */
export function compareSpacing(
  designSpacing: SpacingValue[],
  devSpacing: SpacingValue[],
  tolerance: number = 2
): SpacingDiff[] {
  const diffs: SpacingDiff[] = [];

  designSpacing.forEach(designItem => {
    // 在开发侧寻找匹配的间距
    let bestMatch: SpacingValue | undefined;
    let minDifferences: SpacingDiff['differences'] = [];
    let minSeverity: 'match' | 'partial' | 'mismatch' = 'mismatch';

    devSpacing.forEach(devItem => {
      if (designItem.type !== devItem.type) return;

      const differences: SpacingDiff['differences'] = [];
      let severity: 'match' | 'partial' | 'mismatch' = 'match';

      const positions: Array<'top' | 'right' | 'bottom' | 'left' | 'horizontal' | 'vertical'> = 
        ['top', 'right', 'bottom', 'left', 'horizontal', 'vertical'];

      positions.forEach(pos => {
        const expectedValue = designItem.value[pos];
        const actualValue = devItem.value[pos];

        if (expectedValue !== undefined && actualValue !== undefined) {
          const diff = Math.abs(expectedValue - actualValue);
          if (diff > tolerance) {
            severity = 'partial';
            differences.push({
              position: pos,
              expected: expectedValue,
              actual: actualValue,
              diff,
              tolerance
            });
          }
        }
      });

      // 选择差异最小的匹配
      if (differences.length < minDifferences.length || minDifferences.length === 0) {
        bestMatch = devItem;
        minDifferences = differences;
        minSeverity = severity;
      }
    });

    const overallSeverity: import('@/types').DiffSeverity = minDifferences.length === 0 ? 'low' :
                           minDifferences.length <= 2 ? 'low' :
                           minDifferences.length <= 4 ? 'medium' : 'high';

    diffs.push({
      id: designItem.id,
      nodeId: designItem.nodeId,
      type: designItem.type,
      expected: designItem.value,
      actual: bestMatch?.value,
      differences: minDifferences,
      status: minSeverity,
      severity: overallSeverity
    });
  });

  return diffs;
}

/**
 * 完整的数据对比流程
 */
export function compareData(
  designData: ExtractedDesignData,
  devData: DevExtractedData,
  options: {
    colorTolerance?: number;
    fontSizeTolerance?: number;
    lineHeightTolerance?: number;
    spacingTolerance?: number;
  } = {}
): DataDiffResult {
  const {
    colorTolerance = 10,
    fontSizeTolerance = 1,
    lineHeightTolerance = 2,
    spacingTolerance = 2
  } = options;

  return {
    colors: compareColors(designData.colors, devData.dominantColors, colorTolerance),
    fonts: compareFonts(designData.fonts, devData.fonts, { fontSize: fontSizeTolerance, lineHeight: lineHeightTolerance }),
    spacing: compareSpacing(designData.spacing, devData.spacing, spacingTolerance)
  };
}

/**
 * 计算数据对比的总体得分
 */
export function calculateDataScore(dataDiff: DataDiffResult): number {
  let totalItems = 0;
  let matchedItems = 0;

  const checkStatus = (status: string) => {
    totalItems++;
    if (status === 'match' || status === 'partial') {
      matchedItems++;
    }
  };

  dataDiff.colors.forEach(c => checkStatus(c.status));
  dataDiff.fonts.forEach(f => checkStatus(f.status));
  dataDiff.spacing.forEach(s => checkStatus(s.status));

  return totalItems === 0 ? 100 : (matchedItems / totalItems) * 100;
}
