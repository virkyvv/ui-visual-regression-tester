// 任务相关类型定义

import type { FigmaData } from './figma-data';
import type { DiffResult } from './diff-result';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type DesignSourceType = 'figma' | 'upload' | 'url';

export type DevSourceType = 'api' | 'upload' | 'url' | 'device';

export type ComparisonMode = 'pixel-only' | 'data-only' | 'both';

export type TaskMode = 'single' | 'batch'; // 单图对比 / 批量对比

export interface TaskConfig {
  diffThreshold: number; // 0-100 差异阈值
  ignoreAntialiasing: boolean;
  comparisonMode: ComparisonMode;
  extractColors: boolean;
  extractFonts: boolean;
  extractSpacing: boolean;
}

export interface DesignSource {
  type: DesignSourceType;
  data: FigmaData | File | string;
}

export interface DevSource {
  type: DevSourceType;
  endpoint: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  data?: string; // 存储图片的 base64 数据
}

export interface TestTask {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  designSource: DesignSource;
  devSource: DevSource;
  config: TaskConfig;
  createdAt: Date;
  updatedAt: Date;
  result?: DiffResult;
  error?: string;
  isBatch?: boolean; // 是否为批量任务
  subTasks?: BatchSubTask[]; // 子任务列表（批量任务）
  batchStats?: BatchStatistics; // 统计信息（批量任务）
}

// 批量任务子任务
export interface BatchSubTask {
  id: string;
  designImageName: string;
  devImageName: string;
  designImageData: string; // base64
  devImageData: string; // base64
  result?: DiffResult;
  status: TaskStatus;
  error?: string;
}

// 批量任务统计信息
export interface BatchStatistics {
  totalPairs: number; // 总配对数
  matchedPairs: number; // 成功匹配数
  unmatchedDesign: number; // 未匹配的设计图数
  unmatchedDev: number; // 未匹配的开发图数
  averageSimilarity: number; // 平均相似度
  passCount: number; // 通过数量
  failCount: number; // 失败数量
  totalDiffPixels: number; // 总差异像素
  totalDiffPercentage: number; // 总差异率
}

// 批量测试任务
export interface BatchTestTask {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  mode: 'batch'; // 标识为批量任务
  config: TaskConfig;
  subTasks: BatchSubTask[]; // 子任务列表
  statistics?: BatchStatistics; // 统计信息
  createdAt: Date;
  updatedAt: Date;
}
