import React, { useState, useRef, useEffect } from 'react';
import type { DiffRegion } from '@/types';

interface InteractiveAnnotationProps {
  imageSrc: string;
  regions: DiffRegion[];
}

interface TooltipData {
  region: DiffRegion;
  x: number;
  y: number;
}

/**
 * 获取问题类型的中文名称
 */
function getDiffTypeName(type: string): string {
  const typeNames: Record<string, string> = {
    spacing: '间距异常',
    fontSize: '字号不符',
    color: '颜色偏差',
    borderRadius: '圆角错误',
    layout: '布局问题',
    alignment: '对齐问题',
    size: '尺寸问题',
    other: '其他问题'
  };
  return typeNames[type] || type;
}

/**
 * 获取问题类型的颜色
 */
function getDiffTypeColor(type: string): string {
  const typeColors: Record<string, string> = {
    spacing: '#F59E0B',    // 黄色
    fontSize: '#8B5CF6',   // 紫色
    color: '#EC4899',      // 粉色
    borderRadius: '#06B6D4', // 青色
    layout: '#EF4444',     // 红色
    alignment: '#10B981',  // 绿色
    size: '#F97316',       // 橙色
    other: '#6B7280'       // 灰色
  };
  return typeColors[type] || '#6B7280';
}

export function InteractiveAnnotation({ imageSrc, regions }: InteractiveAnnotationProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 获取图片实际显示尺寸
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({
      width: img.clientWidth,
      height: img.clientHeight
    });
  };

  // 点击框线区域
  const handleRegionClick = (e: React.MouseEvent<HTMLDivElement>, region: DiffRegion) => {
    e.stopPropagation();
    
    // 获取点击位置
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // 设置浮窗位置（确保不超出容器边界）
    const tooltipWidth = 320; // 浮窗最大宽度
    const tooltipX = clickX + 20 + tooltipWidth > rect.width ? clickX - tooltipWidth - 20 : clickX + 20;
    
    setTooltip({
      region,
      x: tooltipX,
      y: Math.max(10, clickY - 50)
    });
  };

  // 点击容器其他区域时关闭浮窗
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 如果点击的不是可点击区域，则关闭浮窗
    if ((e.target as HTMLElement).tagName === 'IMG') {
      setTooltip(null);
    }
  };

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      if (imageRef.current) {
        setImageDimensions({
          width: imageRef.current.clientWidth,
          height: imageRef.current.clientHeight
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative inline-block w-full"
      onClick={handleContainerClick}
    >
      {/* 原始图片 */}
      <img
        ref={imageRef}
        src={imageSrc}
        alt="差异标注图"
        className="max-w-full h-auto"
        onLoad={handleImageLoad}
      />
      
      {/* 可点击的差异区域覆盖层 */}
      {imageDimensions.width > 0 && regions.map((region) => {
        // 使用标注图的原始尺寸计算百分比坐标
        // 如果 region 中记录了 canvas 尺寸，使用它；否则使用显示尺寸（兼容旧数据）
        const canvasWidth = region.canvasWidth || imageDimensions.width;
        const canvasHeight = region.canvasHeight || imageDimensions.height;
        
        // 绿色框：设计稿正确位置（预期）
        const designBox = region.designCorrectX !== undefined && 
                          region.designCorrectY !== undefined &&
                          region.designCorrectWidth !== undefined &&
                          region.designCorrectHeight !== undefined ? {
          left: (region.designCorrectX / canvasWidth) * 100,
          top: (region.designCorrectY / canvasHeight) * 100,
          width: (region.designCorrectWidth / canvasWidth) * 100,
          height: (region.designCorrectHeight / canvasHeight) * 100
        } : null;
        
        // 红色框：开发稿实际位置（实际）
        const devBox = region.devErrorX !== undefined &&
                       region.devErrorY !== undefined &&
                       region.devErrorWidth !== undefined &&
                       region.devErrorHeight !== undefined ? {
          left: (region.devErrorX / canvasWidth) * 100,
          top: (region.devErrorY / canvasHeight) * 100,
          width: (region.devErrorWidth / canvasWidth) * 100,
          height: (region.devErrorHeight / canvasHeight) * 100
        } : null;
        
        return (
          <React.Fragment key={region.id}>
            {/* 绿色框（设计稿位置） */}
            {designBox && (
              <div
                className="absolute cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  left: `${designBox.left}%`,
                  top: `${designBox.top}%`,
                  width: `${designBox.width}%`,
                  height: `${designBox.height}%`,
                  border: '3px solid #22C55E',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  boxSizing: 'border-box'
                }}
                onClick={(e) => handleRegionClick(e, region)}
              />
            )}
            
            {/* 红色框（开发稿位置） */}
            {devBox && (
              <div
                className="absolute cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  left: `${devBox.left}%`,
                  top: `${devBox.top}%`,
                  width: `${devBox.width}%`,
                  height: `${devBox.height}%`,
                  border: '3px solid #EF4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  boxSizing: 'border-box'
                }}
                onClick={(e) => handleRegionClick(e, region)}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* 浮窗提示 */}
      {tooltip && (
        <div
          className="absolute z-50 bg-white rounded-lg shadow-xl border-2 px-4 py-3"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            borderColor: getDiffTypeColor(tooltip.region.type)
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 只显示问题类型标题 */}
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getDiffTypeColor(tooltip.region.type) }}
            />
            <h4 className="font-semibold text-base" style={{ color: getDiffTypeColor(tooltip.region.type) }}>
              {getDiffTypeName(tooltip.region.type)}
            </h4>
          </div>
        </div>
      )}
    </div>
  );
}
