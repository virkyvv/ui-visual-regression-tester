// 差异结果相关类型定义

import type { ColorValue, FontStyle, SpacingValue } from './figma-data';

export type DiffSeverity = 'low' | 'medium' | 'high';

export interface DiffResult {
  pixelDiff: PixelDiffResult;
  dataDiff: DataDiffResult;
  annotatedImage: string; // base64
  overallScore: number; // 0-100 匹配度
}

export interface PixelDiffResult {
  diffPixels: number;
  totalPixels: number;
  diffPercentage: number;
  diffRegions: DiffRegion[];
  isIgnoredByAntialiasing: boolean;
}

export interface DiffRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  severity: DiffSeverity;
  diffPixels: number;
  affectedAreaPercentage: number;
}

export interface DataDiffResult {
  colors: ColorDiff[];
  fonts: FontDiff[];
  spacing: SpacingDiff[];
}

export interface ColorDiff {
  id: string;
  expected: string; // 设计稿颜色
  actual?: string; // 开发侧颜色
  diffValue?: number; // 色差值
  status: 'match' | 'mismatch' | 'missing';
  severity: DiffSeverity;
  nodeId?: string;
}

export interface FontDiff {
  id: string;
  nodeId: string;
  expected: FontStyle;
  actual?: Partial<FontStyle>;
  differences: FontDifference[];
  status: 'match' | 'partial' | 'mismatch' | 'missing';
  severity: DiffSeverity;
}

export interface FontDifference {
  property: 'fontFamily' | 'fontSize' | 'fontWeight' | 'lineHeight' | 'letterSpacing';
  expected: any;
  actual?: any;
  tolerance?: number;
}

export interface SpacingDiff {
  id: string;
  nodeId: string;
  type: 'padding' | 'margin';
  expected: SpacingValue['value'];
  actual?: SpacingValue['value'];
  differences: SpacingDifference[];
  status: 'match' | 'partial' | 'mismatch' | 'missing';
  severity: DiffSeverity;
}

export interface SpacingDifference {
  position: 'top' | 'right' | 'bottom' | 'left' | 'horizontal' | 'vertical';
  expected: number;
  actual?: number;
  diff: number;
  tolerance?: number;
}

export interface DevExtractedData {
  colors: string[];
  dominantColors: ColorValue[];
  fonts: Partial<FontStyle>[];
  spacing: SpacingValue[];
}
