// Figma 相关类型定义

export interface FigmaData {
  fileUrl: string;
  nodeId?: string;
  imageData: string; // base64
  extractedData: ExtractedDesignData;
}

export interface ExtractedDesignData {
  colors: ColorValue[];
  fonts: FontStyle[];
  spacing: SpacingValue[];
}

export interface ColorValue {
  id: string;
  name?: string;
  value: string; // HEX or RGBA
  type: 'fill' | 'stroke' | 'background';
  nodeId?: string;
}

export interface FontStyle {
  id: string;
  nodeId: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
}

export interface SpacingValue {
  id: string;
  nodeId: string;
  type: 'padding' | 'margin';
  value: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    horizontal?: number;
    vertical?: number;
  };
}
