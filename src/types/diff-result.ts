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

// 问题类型枚举
export type DiffType = 
  | 'spacing'      // 间距异常
  | 'fontSize'     // 字号不符
  | 'color'        // 颜色偏差
  | 'borderRadius' // 圆角错误
  | 'layout'       // 布局问题
  | 'alignment'    // 对齐问题
  | 'size'         // 尺寸问题
  | 'other';       // 其他问题

// 组件类型枚举
export type ComponentType = 
  | 'text'         // 文字
  | 'button'       // 按钮
  | 'image'        // 图片
  | 'container'    // 容器
  | 'icon'         // 图标
  | 'rect-block'   // 矩形块
  | 'other';       // 其他

// 方向类型（中文）
export type Direction = '上' | '下' | '左' | '右';

export interface DiffRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  severity: DiffSeverity;
  diffPixels: number;
  affectedAreaPercentage: number;
  
  // 文档要求的输出字段
  type: DiffType;                          // 问题类型
  position: string;                        // 位置描述（DOM位置、截图坐标等）
  expectedValue: string;                   // 预期值（设计稿中的标准参数）
  actualValue: string;                     // 实际值（前端实现的实际参数）
  deviation: string;                       // 偏差描述
  confidence: number;                      // 置信度（0-1）
  
  // 规范化的新字段
  componentType?: ComponentType;             // 组件类型
  componentId?: string;                      // 组件ID
  direction?: Direction;                     // 偏移方向
  pixelValue?: number;                       // 像素值
  designColor?: string;                      // 设计稿颜色（十六进制）
  devColor?: string;                         // 开发稿颜色（十六进制）
  designSize?: { width: number; height: number };  // 设计尺寸
  devSize?: { width: number; height: number };     // 开发尺寸
  sizeType?: '宽' | '高' | '宽高';           // 尺寸类型
  designFont?: string;                       // 设计字体
  devFont?: string;                          // 开发字体
  
  // 设计稿中的正确位置（用于绿色框标注）
  designCorrectX?: number;
  designCorrectY?: number;
  designCorrectWidth?: number;
  designCorrectHeight?: number;
  
  // 开发稿中的错误位置（用于红色框标注）
  devErrorX?: number;
  devErrorY?: number;
  devErrorWidth?: number;
  devErrorHeight?: number;
  
  // 标注图的原始尺寸（用于计算点击区域的正确百分比）
  canvasWidth?: number;
  canvasHeight?: number;
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
