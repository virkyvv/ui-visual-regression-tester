// Figma MCP 集成模块
import type { FigmaData, ExtractedDesignData, ColorValue, FontStyle, SpacingValue } from '@/types';

/**
 * Figma MCP 配置
 */
const FIGMA_MCP_CONFIG = {
  // 这里需要配置 Figma MCP 的访问信息
  // 实际使用时需要从环境变量或配置文件中读取
  serverUrl: 'http://localhost:3000', // Figma MCP 服务地址
  timeout: 30000
};

/**
 * 调用 Figma MCP API
 */
async function callFigmaMCP<T>(method: string, params: any): Promise<T> {
  try {
    const response = await fetch(`${FIGMA_MCP_CONFIG.serverUrl}/figma`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method,
        params
      }),
      signal: AbortSignal.timeout(FIGMA_MCP_CONFIG.timeout)
    });

    if (!response.ok) {
      throw new Error(`Figma MCP request failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Figma MCP API error:', error);
    throw new Error(`Failed to call Figma MCP: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 从 Figma 获取设计稿图片
 */
export async function getFigmaImage(
  fileUrl: string,
  nodeId?: string
): Promise<string> {
  try {
    // 调用 Figma MCP 获取图片
    const imageData = await callFigmaMCP<{ base64: string }>('get_image', {
      fileUrl,
      nodeId
    });

    return imageData.base64;
  } catch (error) {
    console.error('Failed to get Figma image:', error);
    throw error;
  }
}

/**
 * 从 Figma 节点数据中提取颜色值
 */
function extractColorsFromNode(node: any): ColorValue[] {
  const colors: ColorValue[] = [];

  if (node.fills && Array.isArray(node.fills)) {
    node.fills.forEach((fill: any, index: number) => {
      if (fill.type === 'SOLID' && fill.color) {
        const r = Math.round(fill.color.r * 255);
        const g = Math.round(fill.color.g * 255);
        const b = Math.round(fill.color.b * 255);
        const a = fill.opacity !== undefined ? fill.opacity : 1;

        colors.push({
          id: `color-${node.id}-${index}`,
          name: fill.name,
          value: a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
          type: 'fill',
          nodeId: node.id
        });
      }
    });
  }

  if (node.strokes && Array.isArray(node.strokes)) {
    node.strokes.forEach((stroke: any, index: number) => {
      if (stroke.type === 'SOLID' && stroke.color) {
        const r = Math.round(stroke.color.r * 255);
        const g = Math.round(stroke.color.g * 255);
        const b = Math.round(stroke.color.b * 255);
        const a = stroke.opacity !== undefined ? stroke.opacity : 1;

        colors.push({
          id: `stroke-${node.id}-${index}`,
          name: stroke.name,
          value: a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
          type: 'stroke',
          nodeId: node.id
        });
      }
    });
  }

  // 递归处理子节点
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child: any) => {
      colors.push(...extractColorsFromNode(child));
    });
  }

  return colors;
}

/**
 * 从 Figma 节点数据中提取字体样式
 */
function extractFontsFromNode(node: any): FontStyle[] {
  const fonts: FontStyle[] = [];

  if (node.type === 'TEXT') {
    fonts.push({
      id: `font-${node.id}`,
      nodeId: node.id,
      fontFamily: node.style?.fontFamily,
      fontSize: node.style?.fontSize,
      fontWeight: node.style?.fontWeight,
      lineHeight: node.style?.lineHeightPx,
      letterSpacing: node.style?.letterSpacing,
      color: node.fills && node.fills[0]?.color ? 
        `#${Math.round(node.fills[0].color.r * 255).toString(16).padStart(2, '0')}${Math.round(node.fills[0].color.g * 255).toString(16).padStart(2, '0')}${Math.round(node.fills[0].color.b * 255).toString(16).padStart(2, '0')}` 
        : undefined
    });
  }

  // 递归处理子节点
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child: any) => {
      fonts.push(...extractFontsFromNode(child));
    });
  }

  return fonts;
}

/**
 * 从 Figma 节点数据中提取间距值
 */
function extractSpacingFromNode(node: any): SpacingValue[] {
  const spacing: SpacingValue[] = [];

  if (node.layoutMode && (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL')) {
    spacing.push({
      id: `spacing-${node.id}`,
      nodeId: node.id,
      type: 'padding',
      value: {
        top: node.paddingTop,
        right: node.paddingRight,
        bottom: node.paddingBottom,
        left: node.paddingLeft
      }
    });
  }

  if (node.itemSpacing !== undefined) {
    spacing.push({
      id: `item-spacing-${node.id}`,
      nodeId: node.id,
      type: 'padding',
      value: {
        horizontal: node.layoutMode === 'HORIZONTAL' ? node.itemSpacing : undefined,
        vertical: node.layoutMode === 'VERTICAL' ? node.itemSpacing : undefined
      }
    });
  }

  // 递归处理子节点
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child: any) => {
      spacing.push(...extractSpacingFromNode(child));
    });
  }

  return spacing;
}

/**
 * 从 Figma 文件中提取设计数据
 */
export async function extractFigmaData(
  fileUrl: string,
  nodeId?: string,
  options: {
    extractColors?: boolean;
    extractFonts?: boolean;
    extractSpacing?: boolean;
  } = {}
): Promise<ExtractedDesignData> {
  try {
    const {
      extractColors = true,
      extractFonts = true,
      extractSpacing = true
    } = options;

    // 调用 Figma MCP 获取节点数据
    const nodeData = await callFigmaMCP<any>('get_node', {
      fileUrl,
      nodeId
    });

    const extractedData: ExtractedDesignData = {
      colors: [],
      fonts: [],
      spacing: []
    };

    if (extractColors) {
      extractedData.colors = extractColorsFromNode(nodeData);
    }

    if (extractFonts) {
      extractedData.fonts = extractFontsFromNode(nodeData);
    }

    if (extractSpacing) {
      extractedData.spacing = extractSpacingFromNode(nodeData);
    }

    return extractedData;
  } catch (error) {
    console.error('Failed to extract Figma data:', error);
    throw error;
  }
}

/**
 * 完整的 Figma 数据获取流程
 */
export async function getFigmaData(
  fileUrl: string,
  nodeId?: string,
  options: {
    extractColors?: boolean;
    extractFonts?: boolean;
    extractSpacing?: boolean;
  } = {}
): Promise<FigmaData> {
  try {
    // 并行获取图片和数据
    const [imageData, extractedData] = await Promise.all([
      getFigmaImage(fileUrl, nodeId),
      extractFigmaData(fileUrl, nodeId, options)
    ]);

    return {
      fileUrl,
      nodeId,
      imageData,
      extractedData
    };
  } catch (error) {
    console.error('Failed to get Figma data:', error);
    throw error;
  }
}

/**
 * 验证 Figma 文件 URL
 */
export function validateFigmaUrl(url: string): boolean {
  const figmaUrlPattern = /^https:\/\/([a-z0-9-]+\.)*figma\.com\/(file|design)\/[a-zA-Z0-9-]+\/.*/;
  return figmaUrlPattern.test(url);
}
