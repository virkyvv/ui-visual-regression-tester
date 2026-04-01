import { useState } from 'react';
import { TaskProvider, useTasks } from './context/TaskContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { compareImages, generateAnnotatedComparison, matchImagePairs } from './lib/image-diff';
import type { TestTask, TaskStatus, ComparisonMode, TaskMode, BatchSubTask } from './types';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ChevronUpIcon } from './icons/ChevronUpIcon';

function AppContent() {
  const { tasks, addTask, updateTask, deleteTask } = useTasks();
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [expandedDiffListTaskIds, setExpandedDiffListTaskIds] = useState<Set<string>>(new Set());
  
  // 创建任务表单状态
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [designImage, setDesignImage] = useState<string | null>(null);
  const [devImage, setDevImage] = useState<string | null>(null);
  const [diffThreshold, setDiffThreshold] = useState([15]);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('both');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // API 接口配置状态
  const [devSourceType, setDevSourceType] = useState<'upload' | 'api' | 'url' | 'device'>('upload');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [fetchingFromApi, setFetchingFromApi] = useState(false);
  
  // URL 加载状态
  const [imageUrl, setImageUrl] = useState('');
  const [fetchingFromUrl, setFetchingFromUrl] = useState(false);

  // 设备投屏状态
  const [showDeviceStream, setShowDeviceStream] = useState(false);
  const [deviceStreamUrl, setDeviceStreamUrl] = useState('');

  // 剪贴板粘贴状态
  const [showPasteHint, setShowPasteHint] = useState(false);

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<'design' | 'dev' | null>(null);

  // 错误提示状态
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 搜索和排序状态
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // 任务模式状态
  const [taskMode, setTaskMode] = useState<TaskMode>('single');

  // 批量上传状态
  const [batchDesignImages, setBatchDesignImages] = useState<Array<{ name: string; data: string }>>([]);
  const [batchDevImages, setBatchDevImages] = useState<Array<{ name: string; data: string }>>([]);

  // 批量任务子任务Tab选择状态
  const [activeSubTaskIds, setActiveSubTaskIds] = useState<Record<string, string>>({});

  // 过滤和排序任务
  const filteredAndSortedTasks = tasks
    .filter(task => task.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

  const handleDesignImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDesignImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDevImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDevImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 拖拽处理函数
  const handleDragOver = (e: React.DragEvent, target: 'design' | 'dev') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragTarget(target);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragTarget(null);
  };

  const handleDrop = (e: React.DragEvent, target: 'design' | 'dev') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragTarget(null);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // 检查是否为图片
    if (!file.type.startsWith('image/')) {
      setErrorMessage('请拖入图片文件');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (target === 'design') {
        setDesignImage(dataUrl);
      } else {
        setDevImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFolderUpload = async (files: FileList, target: 'design' | 'dev') => {
    if (!files || files.length === 0) return;

    // 找到第一个图片文件
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          if (target === 'design') {
            setDesignImage(dataUrl);
          } else {
            setDevImage(dataUrl);
          }
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  // 批量文件夹上传处理
  const handleBatchFolderUpload = async (files: FileList, target: 'design' | 'dev') => {
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      setErrorMessage('文件夹中没有找到图片文件');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const images: Array<{ name: string; data: string }> = [];

    for (const file of imageFiles) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      images.push({
        name: file.name,
        data: dataUrl
      });
    }

    if (target === 'design') {
      setBatchDesignImages(images);
    } else {
      setBatchDevImages(images);
    }
  };

  // 从 API 获取开发预览图片
  const handleFetchFromApi = async () => {
    if (!apiEndpoint) {
      setErrorMessage('请输入 API 接口地址');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setFetchingFromApi(true);
    try {
      const headers: Record<string, string> = {
        'Accept': 'image/*',
      };
      
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }

      const response = await fetch(apiEndpoint, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onload = (event) => {
        setDevImage(event.target?.result as string);
      };
      
      reader.onerror = () => {
        throw new Error('图片转换失败');
      };
      
      reader.readAsDataURL(blob);
      
    } catch (error) {
      console.error('API fetch error:', error);
      setErrorMessage('从 API 获取图片失败：' + (error instanceof Error ? error.message : '未知错误'));
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setFetchingFromApi(false);
    }
  };

  const handleFetchFromUrl = async () => {
    if (!imageUrl) {
      setErrorMessage('请输入图片 URL');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    // URL 格式验证
    try {
      const urlObj = new URL(imageUrl);
      if (!urlObj.protocol.startsWith('http')) {
        throw new Error('URL 必须以 http:// 或 https:// 开头');
      }
    } catch {
      setErrorMessage('请输入有效的 URL 地址');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setFetchingFromUrl(true);
    try {
      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'Accept': 'image/*',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP 请求失败: ${response.status} ${response.statusText}`);
      }

      // 检查响应类型是否为图片
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error('URL 返回的不是有效的图片文件');
      }

      const blob = await response.blob();

      // 将 Blob 转换为 Base64
      const reader = new FileReader();

      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        setDevImage(base64Data);
        setErrorMessage('图片加载成功！');
        setTimeout(() => setErrorMessage(null), 3000);
      };

      reader.onerror = () => {
        throw new Error('图片数据转换失败');
      };

      reader.readAsDataURL(blob);

    } catch (error) {
      console.error('URL fetch error:', error);
      let errorMsg = '从 URL 加载图片失败';

      if (error instanceof Error) {
        // 提供更友好的错误提示
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMsg += '：网络连接失败，请检查 URL 是否正确或是否存在跨域限制';
        } else {
          errorMsg += '：' + error.message;
        }
      }

      setErrorMessage(errorMsg);
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setFetchingFromUrl(false);
    }
  };

  // 设备投屏截图功能
  const handleCaptureDeviceScreen = async () => {
    if (!showDeviceStream || !deviceStreamUrl) {
      setErrorMessage('请先开启设备投屏');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    try {
      // 创建 Image 对象加载投屏画面
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = deviceStreamUrl;
      });

      // 创建 Canvas 截取当前画面
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas context 创建失败');
      }

      ctx.drawImage(img, 0, 0);

      // 将 Canvas 转换为 Base64
      const base64Data = canvas.toDataURL('image/png');
      setDevImage(base64Data);
      setErrorMessage('设备屏幕截图成功！');
      setTimeout(() => setErrorMessage(null), 3000);

    } catch (error) {
      console.error('Capture error:', error);
      setErrorMessage('截图失败：' + (error instanceof Error ? error.message : '未知错误'));
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  // 剪贴板粘贴功能
  const handlePaste = async (e: React.ClipboardEvent, target: 'design' | 'dev') => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64Data = event.target?.result as string;
            if (target === 'design') {
              setDesignImage(base64Data);
            } else {
              setDevImage(base64Data);
            }
            setErrorMessage(`${target === 'design' ? '设计稿' : '开发预览'}图片粘贴成功！`);
            setTimeout(() => setErrorMessage(null), 3000);
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    }
  };

  // 切换单个任务的展开/收起状态
  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // 切换单个任务差异区域列表的展开/收起状态
  const toggleDiffListExpansion = (taskId: string) => {
    setExpandedDiffListTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // 删除任务
  const handleDeleteTask = (taskId: string) => {
    // 直接删除，不使用 confirm 对话框
    deleteTask(taskId);
  };

  const handleCreateTask = async () => {
    if (!taskName || !designImage || !devImage) {
      setErrorMessage('请填写任务名称并上传两张图片');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setIsProcessing(true);

    try {
      // 创建任务
      const newTask: TestTask = {
        id: `task-${Date.now()}`,
        name: taskName,
        description: taskDescription,
        status: 'processing',
        designSource: {
          type: 'upload',
          data: designImage
        },
        devSource: {
          type: devSourceType === 'api' ? 'api' : 'api',
          endpoint: devSourceType === 'api' ? apiEndpoint : 'manual-upload',
          method: devSourceType === 'api' ? 'GET' as const : 'POST' as const,
          headers: devSourceType === 'api' && apiToken ? { 'Authorization': `Bearer ${apiToken}` } : undefined,
          data: devImage
        },
        config: {
          diffThreshold: diffThreshold[0],
          ignoreAntialiasing: true,
          comparisonMode,
          extractColors: true,
          extractFonts: true,
          extractSpacing: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      addTask(newTask);

      // 执行图像对比
      const pixelDiff = await compareImages(
        designImage,
        devImage,
        diffThreshold[0],
        true
      );

      // 生成标注图
      const annotatedImage = await generateAnnotatedComparison(
        designImage,
        devImage,
        diffThreshold[0],
        true
      );

      // 计算总体得分
      const overallScore = Math.max(0, 100 - pixelDiff.diffPercentage);

      // 更新任务结果
      updateTask(newTask.id, {
        status: 'completed',
        result: {
          pixelDiff,
          dataDiff: {
            colors: [],
            fonts: [],
            spacing: []
          },
          annotatedImage,
          overallScore
        }
      });

      // 切换到任务列表并展开新任务
      setActiveTab('list');
      setExpandedTaskIds(new Set([newTask.id]));
      setTaskName('');
      setTaskDescription('');
      setDesignImage(null);
      setDevImage(null);
      setApiEndpoint('');
      setApiToken('');
      setDevSourceType('upload');
    } catch (error) {
      console.error('Task creation error:', error);
      setErrorMessage('任务创建失败：' + (error instanceof Error ? error.message : '未知错误'));
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  // 创建批量对比任务
  const handleCreateBatchTask = async () => {
    if (!taskName) {
      setErrorMessage('请填写任务名称');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    if (batchDesignImages.length === 0 || batchDevImages.length === 0) {
      setErrorMessage('请上传两个文件夹的图片');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setIsProcessing(true);

    try {
      // 匹配图片对
      const matchedPairs = await matchImagePairs(batchDesignImages, batchDevImages);

      if (matchedPairs.length === 0) {
        setErrorMessage('未能匹配到任何图片对');
        setTimeout(() => setErrorMessage(null), 5000);
        setIsProcessing(false);
        return;
      }

      // 创建子任务
      const subTasks: BatchSubTask[] = matchedPairs.map((pair, index) => ({
        id: `subtask-${Date.now()}-${index}`,
        designImageName: pair.design.name,
        devImageName: pair.dev.name,
        designImageData: pair.design.data,
        devImageData: pair.dev.data,
        status: 'pending' as TaskStatus
      }));

      // 创建主任务
      const newTask: TestTask = {
        id: `task-${Date.now()}`,
        name: taskName,
        description: taskDescription,
        status: 'processing',
        designSource: {
          type: 'upload',
          data: `${batchDesignImages.length} design images`
        },
        devSource: {
          type: 'api',
          endpoint: 'batch-upload',
          method: 'POST',
          data: `${batchDevImages.length} dev images`
        },
        config: {
          diffThreshold: diffThreshold[0],
          ignoreAntialiasing: true,
          comparisonMode,
          extractColors: true,
          extractFonts: true,
          extractSpacing: true
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isBatch: true,
        subTasks,
        batchStats: {
          totalPairs: matchedPairs.length,
          matchedPairs: 0,
          unmatchedDesign: batchDesignImages.length - matchedPairs.length,
          unmatchedDev: batchDevImages.length - matchedPairs.length,
          averageSimilarity: 0,
          passCount: 0,
          failCount: 0,
          totalDiffPixels: 0,
          totalDiffPercentage: 0
        }
      };

      addTask(newTask);

      // 并行处理所有子任务
      let completedCount = 0;
      let totalDiffPixels = 0;
      let totalDiffPercentage = 0;
      let passCount = 0;
      let failCount = 0;

      // 存储所有子任务的更新结果
      const updatedSubTasks: BatchSubTask[] = new Array(subTasks.length);

      await Promise.all(
        subTasks.map(async (subTask, index) => {
          try {
            // 执行图像对比
            const pixelDiff = await compareImages(
              subTask.designImageData,
              subTask.devImageData,
              diffThreshold[0],
              true
            );

            // 生成标注图
            const annotatedImage = await generateAnnotatedComparison(
              subTask.designImageData,
              subTask.devImageData,
              diffThreshold[0],
              true
            );

            // 计算得分
            const overallScore = Math.max(0, 100 - pixelDiff.diffPercentage);

            // 累计统计
            totalDiffPixels += pixelDiff.diffPixels;
            totalDiffPercentage += pixelDiff.diffPercentage;
            if (overallScore >= 90) {
              passCount++;
            } else {
              failCount++;
            }
            completedCount++;

            // 保存更新后的子任务
            updatedSubTasks[index] = {
              ...subTask,
              status: 'completed',
              result: {
                pixelDiff,
                dataDiff: {
                  colors: [],
                  fonts: [],
                  spacing: []
                },
                annotatedImage,
                overallScore
              }
            };

          } catch (error) {
            console.error(`Subtask ${index} failed:`, error);
            updatedSubTasks[index] = {
              ...subTask,
              status: 'failed',
              error: error instanceof Error ? error.message : '未知错误'
            };
            failCount++;
          }
        })
      );

      // 一次性更新所有子任务
      updateTask(newTask.id, {
        subTasks: updatedSubTasks
      });

      // 计算平均相似度
      const averageSimilarity = completedCount > 0 
        ? (passCount / completedCount) * 100 
        : 0;

      // 更新最终统计
      updateTask(newTask.id, {
        status: 'completed',
        batchStats: {
          totalPairs: matchedPairs.length,
          matchedPairs: completedCount,
          unmatchedDesign: batchDesignImages.length - matchedPairs.length,
          unmatchedDev: batchDevImages.length - matchedPairs.length,
          averageSimilarity,
          passCount,
          failCount,
          totalDiffPixels,
          totalDiffPercentage: completedCount > 0 ? totalDiffPercentage / completedCount : 0
        }
      });

      // 切换到任务列表
      setActiveTab('list');
      setExpandedTaskIds(new Set([newTask.id]));
      
      // 清空表单
      setTaskName('');
      setTaskDescription('');
      setBatchDesignImages([]);
      setBatchDevImages([]);

    } catch (error) {
      console.error('Batch task creation error:', error);
      setErrorMessage('批量任务创建失败：' + (error instanceof Error ? error.message : '未知错误'));
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    const statusMap = {
      pending: { label: '待处理', color: 'bg-gray-500' },
      processing: { label: '处理中', color: 'bg-blue-500' },
      completed: { label: '已完成', color: 'bg-green-500' },
      failed: { label: '失败', color: 'bg-red-500' }
    };
    const { label, color } = statusMap[status];
    return <Badge className={color}>{label}</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    const severityMap = {
      low: { label: '低', color: 'bg-yellow-500' },
      medium: { label: '中', color: 'bg-orange-500' },
      high: { label: '高', color: 'bg-red-500' }
    };
    const { label, color } = severityMap[severity as keyof typeof severityMap] || severityMap.low;
    return <Badge className={color}>{label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-slate-900">
              UI 视觉回归测试平台
            </h1>
            <div className="flex gap-2">
              <Button 
                type="button"
                variant={activeTab === 'list' ? 'default' : 'outline'} 
                onClick={() => setActiveTab('list')}
              >
                任务列表 ({tasks.length})
              </Button>
              <Button 
                type="button"
                variant={activeTab === 'create' ? 'default' : 'outline'}
                onClick={() => setActiveTab('create')}
              >
                创建新任务
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 错误提示 */}
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {errorMessage}
          </div>
        )}

        {activeTab === 'create' && (
          <Card>
            <CardHeader>
              <CardTitle>创建新的视觉对比测试</CardTitle>
              <CardDescription>
                上传设计稿和开发预览图，自动检测 UI 还原度差异
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 模式切换 */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={taskMode === 'single' ? 'default' : 'outline'}
                  onClick={() => setTaskMode('single')}
                >
                  单图对比
                </Button>
                <Button
                  type="button"
                  variant={taskMode === 'batch' ? 'default' : 'outline'}
                  onClick={() => setTaskMode('batch')}
                >
                  批量对比
                </Button>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">任务名称</label>
                  <Input
                    placeholder="输入任务名称"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">任务描述</label>
                  <Input
                    placeholder="输入任务描述（可选）"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* 单图对比模式 */}
              {taskMode === 'single' && (
              <>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* 设计稿图片区域 */}
                <div
                  className={`space-y-3 p-6 rounded-lg border-2 border-dashed transition-all ${
                    dragTarget === 'design' && isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300'
                  }`}
                  onDragOver={(e) => handleDragOver(e, 'design')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'design')}
                  onPaste={(e) => handlePaste(e, 'design')}
                  tabIndex={0}
                  onClick={() => {
                    setShowPasteHint(true);
                    setTimeout(() => setShowPasteHint(false), 3000);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div>
                    <label className="text-sm font-medium">设计稿图片</label>
                    <p className="text-xs text-slate-500 mt-1">
                      {showPasteHint ? (
                        <span className="text-blue-600 font-medium">💡 现在可以粘贴截图了！Ctrl+V / Cmd+V</span>
                      ) : (
                        '支持拖入图片、点击上传或点击后粘贴截图'
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleDesignImageUpload}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.webkitdirectory = true;
                        input.onchange = (e) => {
                          if (e.target instanceof HTMLInputElement && e.target.files) {
                            handleFolderUpload(e.target.files, 'design');
                          }
                        };
                        input.click();
                      }}
                      title="上传文件夹"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </Button>
                  </div>
                  {designImage && (
                    <div className="relative group">
                      <img
                        src={designImage}
                        alt="设计稿"
                        className="rounded-lg border border-slate-200 max-h-64 object-contain"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDesignImage(null);
                        }}
                        title="删除图片"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12"></path>
                        </svg>
                      </Button>
                    </div>
                  )}
                </div>

                {/* 开发预览图片区域 */}
                <div
                  className={`space-y-3 p-6 rounded-lg border-2 border-dashed transition-all ${
                    dragTarget === 'dev' && isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300'
                  }`}
                  onDragOver={(e) => handleDragOver(e, 'dev')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'dev')}
                  onPaste={(e) => handlePaste(e, 'dev')}
                  tabIndex={0}
                  onClick={() => {
                    setShowPasteHint(true);
                    setTimeout(() => setShowPasteHint(false), 3000);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">开发预览图片</label>
                      <p className="text-xs text-slate-500 mt-1">
                        {showPasteHint ? (
                          <span className="text-blue-600 font-medium">💡 现在可以粘贴截图了！Ctrl+V / Cmd+V</span>
                        ) : (
                          '支持拖入图片、点击上传或点击后粘贴截图'
                        )}
                      </p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Select value={devSourceType} onValueChange={(v) => setDevSourceType(v as 'upload' | 'api' | 'url' | 'device')}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upload">手动上传</SelectItem>
                          <SelectItem value="api">API 接口</SelectItem>
                          <SelectItem value="url">从 URL 加载</SelectItem>
                          <SelectItem value="device">设备投屏</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {devSourceType === 'upload' ? (
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleDevImageUpload}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.webkitdirectory = true;
                          input.onchange = (e) => {
                            if (e.target instanceof HTMLInputElement && e.target.files) {
                              handleFolderUpload(e.target.files, 'dev');
                            }
                          };
                          input.click();
                        }}
                        title="上传文件夹"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                      </Button>
                    </div>
                  ) : devSourceType === 'api' ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label htmlFor="api-endpoint">API 接口地址</Label>
                        <Input
                          id="api-endpoint"
                          placeholder="https://your-dev-server.com/api/screenshot"
                          value={apiEndpoint}
                          onChange={(e) => setApiEndpoint(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="api-token">访问令牌（可选）</Label>
                        <Input
                          id="api-token"
                          type="password"
                          placeholder="Bearer Token"
                          value={apiToken}
                          onChange={(e) => setApiToken(e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleFetchFromApi}
                        disabled={fetchingFromApi || !apiEndpoint}
                        variant="outline"
                        className="w-full"
                      >
                        {fetchingFromApi ? '获取中...' : '从接口获取图片'}
                      </Button>
                    </div>
                  ) : devSourceType === 'url' ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label htmlFor="image-url">图片 URL</Label>
                        <Input
                          id="image-url"
                          type="url"
                          placeholder="请输入图片 URL（http:// 或 https://）"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleFetchFromUrl();
                            }
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleFetchFromUrl}
                        disabled={fetchingFromUrl || !imageUrl}
                        className="w-full"
                      >
                        {fetchingFromUrl ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            加载中...
                          </>
                        ) : (
                          '加载图片'
                        )}
                      </Button>
                    </div>
                  ) : devSourceType === 'device' ? (
                    <div className="space-y-3">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="text-sm font-medium text-blue-900 mb-1">设备投屏使用说明</div>
                        <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                          <li>安装投屏软件（推荐：Vysor、Scrcpy）</li>
                          <li>USB 连接设备到电脑</li>
                          <li>在输入框中填入投屏画面 URL</li>
                          <li>点击"截图"按钮捕获当前屏幕</li>
                        </ol>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="device-stream-url">投屏画面 URL</Label>
                        <Input
                          id="device-stream-url"
                          type="url"
                          placeholder="例如：http://localhost:3000/stream.jpg"
                          value={deviceStreamUrl}
                          onChange={(e) => setDeviceStreamUrl(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={() => setShowDeviceStream(!showDeviceStream)}
                          disabled={!deviceStreamUrl}
                          variant={showDeviceStream ? "destructive" : "default"}
                          className="flex-1"
                        >
                          {showDeviceStream ? '关闭投屏' : '开启投屏'}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleCaptureDeviceScreen}
                          disabled={!showDeviceStream}
                          variant="outline"
                          className="flex-1"
                        >
                          截图
                        </Button>
                      </div>
                      {showDeviceStream && deviceStreamUrl && (
                        <div className="rounded-lg border border-slate-200 overflow-hidden bg-black">
                          <img
                            src={deviceStreamUrl}
                            alt="设备投屏画面"
                            className="w-full object-contain"
                            style={{ maxHeight: '400px' }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              setErrorMessage('无法加载投屏画面，请检查 URL 是否正确');
                              setTimeout(() => setErrorMessage(null), 5000);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : null}

                  {devImage && (
                    <div className="relative group">
                      <img
                        src={devImage}
                        alt="开发预览"
                        className="rounded-lg border border-slate-200 max-h-64 object-contain"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDevImage(null);
                        }}
                        title="删除图片"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12"></path>
                        </svg>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* 配置区域 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    差异阈值: {diffThreshold[0]}%
                  </label>
                  <Slider
                    value={diffThreshold}
                    onValueChange={setDiffThreshold}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-600">
                    阈值越低，检测越严格。推荐值：10-20%
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">对比模式</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'pixel-only', label: '仅像素对比' },
                      { value: 'data-only', label: '仅数据对比' },
                      { value: 'both', label: '双重对比' }
                    ].map((mode) => (
                      <Button
                        key={mode.value}
                        type="button"
                        variant={comparisonMode === mode.value ? 'default' : 'outline'}
                        onClick={() => setComparisonMode(mode.value as ComparisonMode)}
                      >
                        {mode.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={taskMode === 'single' ? handleCreateTask : handleCreateBatchTask}
                disabled={isProcessing}
                className="w-full"
                size="lg"
              >
                {isProcessing ? '处理中...' : taskMode === 'single' ? '开始对比测试' : '开始批量测试'}
              </Button>
              </>
              )}

              {/* 批量对比模式 */}
              {taskMode === 'batch' && (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* 设计稿文件夹区域 */}
                <div
                  className={`space-y-3 p-6 rounded-lg border-2 border-dashed transition-all ${
                    dragTarget === 'design' && isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300'
                  }`}
                  onDragOver={(e) => handleDragOver(e, 'design')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // 处理批量文件夹上传
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      handleBatchFolderUpload(files, 'design');
                    }
                  }}
                >
                  <div>
                    <label className="text-sm font-medium">设计稿文件夹</label>
                    <p className="text-xs text-slate-500 mt-1">上传包含设计稿图片的文件夹</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.multiple = true;
                      input.onchange = (e) => {
                        if (e.target instanceof HTMLInputElement && e.target.files) {
                          handleBatchFolderUpload(e.target.files, 'design');
                        }
                      };
                      input.click();
                    }}
                  >
                    选择图片文件
                  </Button>
                  {batchDesignImages.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600">已上传 {batchDesignImages.length} 张图片:</p>
                      <div className="grid grid-cols-4 gap-2 max-h-[280px] overflow-y-auto p-2 bg-slate-50 rounded-lg">
                        {batchDesignImages.map((img, idx) => (
                          <div key={idx} className="relative group aspect-square">
                            <img
                              src={img.data}
                              alt={img.name}
                              className="w-full h-full object-cover rounded border border-slate-200"
                              title={img.name}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setBatchDesignImages(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                              title="删除图片"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6L6 18M6 6l12 12"></path>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 开发图文件夹区域 */}
                <div
                  className={`space-y-3 p-6 rounded-lg border-2 border-dashed transition-all ${
                    dragTarget === 'dev' && isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300'
                  }`}
                  onDragOver={(e) => handleDragOver(e, 'dev')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      handleBatchFolderUpload(files, 'dev');
                    }
                  }}
                >
                  <div>
                    <label className="text-sm font-medium">开发图文件夹</label>
                    <p className="text-xs text-slate-500 mt-1">上传包含开发预览图图片的文件夹</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.multiple = true;
                      input.onchange = (e) => {
                        if (e.target instanceof HTMLInputElement && e.target.files) {
                          handleBatchFolderUpload(e.target.files, 'dev');
                        }
                      };
                      input.click();
                    }}
                  >
                    选择图片文件
                  </Button>
                  {batchDevImages.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600">已上传 {batchDevImages.length} 张图片:</p>
                      <div className="grid grid-cols-4 gap-2 max-h-[280px] overflow-y-auto p-2 bg-slate-50 rounded-lg">
                        {batchDevImages.map((img, idx) => (
                          <div key={idx} className="relative group aspect-square">
                            <img
                              src={img.data}
                              alt={img.name}
                              className="w-full h-full object-cover rounded border border-slate-200"
                              title={img.name}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setBatchDevImages(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                              title="删除图片"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6L6 18M6 6l12 12"></path>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* 配置区域 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    差异阈值: {diffThreshold[0]}%
                  </label>
                  <Slider
                    value={diffThreshold}
                    onValueChange={setDiffThreshold}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-600">
                    阈值越低,检测越严格。推荐值:10-20%
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">对比模式</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'pixel-only', label: '仅像素对比' },
                      { value: 'data-only', label: '仅数据对比' },
                      { value: 'both', label: '双重对比' }
                    ].map((mode) => (
                      <Button
                        key={mode.value}
                        type="button"
                        variant={comparisonMode === mode.value ? 'default' : 'outline'}
                        onClick={() => setComparisonMode(mode.value as ComparisonMode)}
                      >
                        {mode.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleCreateBatchTask}
                disabled={isProcessing}
                className="w-full"
                size="lg"
              >
                {isProcessing ? '处理中...' : '开始批量测试'}
              </Button>
              </>
              )}
            </CardContent>
          </Card>
        )}
        
        {activeTab === 'list' && (
          <div className="space-y-4">
            {/* 搜索和排序 */}
            <div className="flex gap-3 items-center">
              <Input
                placeholder="搜索任务名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'newest' | 'oldest')}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">时间从上往下</SelectItem>
                  <SelectItem value="oldest">时间从下往上</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredAndSortedTasks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  {tasks.length === 0 ? (
                    <p className="text-slate-500">暂无测试任务，点击上方按钮创建新任务</p>
                  ) : (
                    <p className="text-slate-500">未找到匹配的任务</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredAndSortedTasks.map((task) => {
                const isExpanded = expandedTaskIds.has(task.id);
                
                return (
                  <Card key={task.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CardTitle className="text-lg">
                                {task.name}
                                {task.isBatch && (
                                  <Badge variant="outline" className="ml-2">批量</Badge>
                                )}
                              </CardTitle>
                              <span className="text-sm text-slate-500">
                                {new Date(task.createdAt).toLocaleString('zh-CN', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <div className="flex gap-2 items-center">
                              {getStatusBadge(task.status)}
                              {task.isBatch && task.batchStats ? (
                                <Badge variant={task.batchStats.averageSimilarity >= 90 ? 'default' : 'destructive'}>
                                  相似度: {task.batchStats.averageSimilarity.toFixed(1)}%
                                </Badge>
                              ) : task.result && (
                                <Badge variant={task.result.overallScore >= 90 ? 'default' : 'destructive'}>
                                  得分: {task.result.overallScore.toFixed(1)}%
                                </Badge>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                title="删除任务"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18"></path>
                                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                </svg>
                              </Button>
                            </div>
                          </div>
                          
                          {/* 始终显示的基本信息 */}
                          {task.status === 'completed' && (task.result || (task.isBatch && task.batchStats)) && (
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex gap-6 text-sm text-slate-600">
                                {task.isBatch && task.batchStats ? (
                                  <>
                                    <span>总图片对: {task.batchStats.totalPairs}</span>
                                    <span>通过: {task.batchStats.passCount}</span>
                                    <span>失败: {task.batchStats.failCount}</span>
                                    <span>平均相似度: {task.batchStats.averageSimilarity.toFixed(1)}%</span>
                                  </>
                                ) : task.result ? (
                                  <>
                                    <span>差异像素: {task.result.pixelDiff.diffPixels}</span>
                                    <span>差异率: {task.result.pixelDiff.diffPercentage.toFixed(2)}%</span>
                                    <span>差异区域: {task.result.pixelDiff.diffRegions.length}</span>
                                  </>
                                ) : null}
                              </div>

                              {/* 展开/收起按钮 */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleTaskExpansion(task.id)}
                                className="flex items-center gap-1 text-sm"
                              >
                                {isExpanded ? (
                                  <>
                                    收起结果
                                    <ChevronUpIcon size={16} />
                                  </>
                                ) : (
                                  <>
                                    展开结果
                                    <ChevronDownIcon size={16} />
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {/* 展开的详细结果 */}
                    {isExpanded && task.status === 'completed' && task.result && (
                      <CardContent className="space-y-6 border-t pt-6">
                        <div>
                          <h3 className="text-lg font-semibold mb-3">图片对比</h3>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* 设计稿 */}
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-slate-700">设计稿</h4>
                              <div 
                                id={`design-scroll-${task.id}`}
                                className="max-h-[400px] overflow-y-auto rounded-lg border border-slate-200"
                                style={{ scrollBehavior: 'auto' }}
                                onScroll={(e) => {
                                  const target = e.currentTarget;
                                  const partner = document.getElementById(`diff-scroll-${task.id}`) as HTMLElement;
                                  if (partner) {
                                    partner.scrollTop = target.scrollTop;
                                  }
                                }}
                                onWheel={(e) => {
                                  const target = e.currentTarget;
                                  if (target.scrollHeight > target.clientHeight) {
                                    e.stopPropagation();
                                  }
                                }}
                              >
                                <img
                                  src={task.designSource.data as string}
                                  alt="设计稿"
                                  className="max-w-full object-contain"
                                />
                              </div>
                            </div>

                            {/* 差异标注图 */}
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-slate-700">差异标注</h4>
                              <div 
                                id={`diff-scroll-${task.id}`}
                                className="max-h-[400px] overflow-y-auto rounded-lg border border-slate-200"
                                style={{ scrollBehavior: 'auto' }}
                                onScroll={(e) => {
                                  const target = e.currentTarget;
                                  const partner = document.getElementById(`design-scroll-${task.id}`) as HTMLElement;
                                  if (partner) {
                                    partner.scrollTop = target.scrollTop;
                                  }
                                }}
                                onWheel={(e) => {
                                  const target = e.currentTarget;
                                  if (target.scrollHeight > target.clientHeight) {
                                    e.stopPropagation();
                                  }
                                }}
                              >
                                <img
                                  src={task.result.annotatedImage}
                                  alt="差异标注"
                                  className="max-w-full object-contain"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold">差异区域列表</h3>
                            {task.result.pixelDiff.diffRegions.length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleDiffListExpansion(task.id)}
                                className="flex items-center gap-1 text-sm"
                              >
                                {expandedDiffListTaskIds.has(task.id) ? (
                                  <>
                                    收起列表
                                    <ChevronUpIcon size={16} />
                                  </>
                                ) : (
                                  <>
                                    展开列表
                                    <ChevronDownIcon size={16} />
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                          {task.result.pixelDiff.diffRegions.length === 0 ? (
                            <p className="text-green-600">✅ 未检测到差异，UI 还原度完美！</p>
                          ) : expandedDiffListTaskIds.has(task.id) ? (
                            <div className="space-y-2">
                              {task.result.pixelDiff.diffRegions.map((region: any) => (
                                <div
                                  key={region.id}
                                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg"
                                >
                                  <div>
                                    <span className="font-medium">位置: ({region.x}, {region.y})</span>
                                    <span className="text-slate-600 ml-2">
                                      尺寸: {region.width}x{region.height}
                                    </span>
                                    <span className="text-slate-600 ml-2">
                                      影响面积: {region.affectedAreaPercentage.toFixed(2)}%
                                    </span>
                                  </div>
                                  {getSeverityBadge(region.severity)}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-600 text-sm">点击"展开列表"查看 {task.result.pixelDiff.diffRegions.length} 个差异区域的详细信息</p>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold text-slate-900">
                              {task.result.pixelDiff.diffPixels}
                            </div>
                            <div className="text-sm text-slate-600">差异像素</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-slate-900">
                              {task.result.pixelDiff.diffPercentage.toFixed(2)}%
                            </div>
                            <div className="text-sm text-slate-600">差异率</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-slate-900">
                              {task.result.pixelDiff.diffRegions.length}
                            </div>
                            <div className="text-sm text-slate-600">差异区域</div>
                          </div>
                        </div>
                      </CardContent>
                    )}

                    {/* 批量任务展开结果 */}
                    {isExpanded && task.isBatch && task.status === 'completed' && task.batchStats && (
                      <CardContent className="space-y-6 border-t pt-6">
                        {/* 批量任务统计卡片 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-900">{task.batchStats.totalPairs}</div>
                            <div className="text-sm text-blue-700">总图片对</div>
                          </div>
                          <div className="p-4 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-900">{task.batchStats.averageSimilarity.toFixed(1)}%</div>
                            <div className="text-sm text-green-700">平均相似度</div>
                          </div>
                          <div className="p-4 bg-emerald-50 rounded-lg">
                            <div className="text-2xl font-bold text-emerald-900">{task.batchStats.passCount}</div>
                            <div className="text-sm text-emerald-700">通过</div>
                          </div>
                          <div className="p-4 bg-red-50 rounded-lg">
                            <div className="text-2xl font-bold text-red-900">{task.batchStats.failCount}</div>
                            <div className="text-sm text-red-700">失败</div>
                          </div>
                        </div>

                        {/* 详细统计信息 */}
                        <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                          <h4 className="font-semibold text-slate-900">详细统计</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>匹配对数: {task.batchStats.matchedPairs}</div>
                            <div>未匹配设计图: {task.batchStats.unmatchedDesign}</div>
                            <div>未匹配开发图: {task.batchStats.unmatchedDev}</div>
                            <div>总差异像素: {task.batchStats.totalDiffPixels}</div>
                            <div>平均差异率: {task.batchStats.totalDiffPercentage.toFixed(2)}%</div>
                          </div>
                        </div>

                        {/* 子任务Tab展示 */}
                        {task.subTasks && task.subTasks.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold mb-3">子任务对比结果</h3>
                            <Tabs
                              value={activeSubTaskIds[task.id] || task.subTasks[0].id}
                              onValueChange={(value) => setActiveSubTaskIds(prev => ({ ...prev, [task.id]: value }))}
                            >
                              <TabsList className="mb-4 flex-wrap">
                                {task.subTasks.map((subTask, index) => (
                                  <TabsTrigger key={subTask.id} value={subTask.id} className="text-xs">
                                    {index + 1}. {subTask.designImageName}
                                  </TabsTrigger>
                                ))}
                              </TabsList>

                              {task.subTasks.map((subTask) => (
                                <TabsContent key={subTask.id} value={subTask.id}>
                                  <div className="space-y-4">
                                    {/* 子任务状态 */}
                                    <div className="flex items-center gap-3">
                                      <h4 className="font-semibold text-slate-900">
                                        {subTask.designImageName} vs {subTask.devImageName}
                                      </h4>
                                      {getStatusBadge(subTask.status)}
                                      {subTask.result && (
                                        <Badge variant={subTask.result.overallScore >= 90 ? 'default' : 'destructive'}>
                                          得分: {subTask.result.overallScore.toFixed(1)}%
                                        </Badge>
                                      )}
                                    </div>

                                    {/* 子任务错误信息 */}
                                    {subTask.error && (
                                      <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                                        错误: {subTask.error}
                                      </div>
                                    )}

                                    {/* 子任务结果 */}
                                    {subTask.status === 'completed' && subTask.result && (
                                      <div className="space-y-4">
                                        {/* 图片对比 */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <h4 className="text-sm font-medium text-slate-700">设计稿</h4>
                                            <div 
                                              id={`batch-design-scroll-${subTask.id}`}
                                              className="max-h-[400px] overflow-y-auto rounded-lg border border-slate-200"
                                              style={{ scrollBehavior: 'auto' }}
                                              onScroll={(e) => {
                                                const target = e.currentTarget;
                                                const partner = document.getElementById(`batch-diff-scroll-${subTask.id}`) as HTMLElement;
                                                if (partner) {
                                                  partner.scrollTop = target.scrollTop;
                                                }
                                              }}
                                              onWheel={(e) => {
                                                const target = e.currentTarget;
                                                if (target.scrollHeight > target.clientHeight) {
                                                  e.stopPropagation();
                                                }
                                              }}
                                            >
                                              <img
                                                src={subTask.designImageData}
                                                alt="设计稿"
                                                className="max-w-full object-contain"
                                              />
                                            </div>
                                          </div>
                                          <div className="space-y-2">
                                            <h4 className="text-sm font-medium text-slate-700">差异标注</h4>
                                            <div 
                                              id={`batch-diff-scroll-${subTask.id}`}
                                              className="max-h-[400px] overflow-y-auto rounded-lg border border-slate-200"
                                              style={{ scrollBehavior: 'auto' }}
                                              onScroll={(e) => {
                                                const target = e.currentTarget;
                                                const partner = document.getElementById(`batch-design-scroll-${subTask.id}`) as HTMLElement;
                                                if (partner) {
                                                  partner.scrollTop = target.scrollTop;
                                                }
                                              }}
                                              onWheel={(e) => {
                                                const target = e.currentTarget;
                                                if (target.scrollHeight > target.clientHeight) {
                                                  e.stopPropagation();
                                                }
                                              }}
                                            >
                                              <img
                                                src={subTask.result.annotatedImage}
                                                alt="差异标注"
                                                className="max-w-full object-contain"
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {/* 统计信息 */}
                                        <div className="grid grid-cols-3 gap-4 text-center p-4 bg-slate-50 rounded-lg">
                                          <div>
                                            <div className="text-xl font-bold text-slate-900">
                                              {subTask.result.pixelDiff.diffPixels}
                                            </div>
                                            <div className="text-xs text-slate-600">差异像素</div>
                                          </div>
                                          <div>
                                            <div className="text-xl font-bold text-slate-900">
                                              {subTask.result.pixelDiff.diffPercentage.toFixed(2)}%
                                            </div>
                                            <div className="text-xs text-slate-600">差异率</div>
                                          </div>
                                          <div>
                                            <div className="text-xl font-bold text-slate-900">
                                              {subTask.result.pixelDiff.diffRegions.length}
                                            </div>
                                            <div className="text-xs text-slate-600">差异区域</div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TabsContent>
                              ))}
                            </Tabs>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <TaskProvider>
      <AppContent />
    </TaskProvider>
  );
}

export default App;
