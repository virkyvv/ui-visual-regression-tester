// 任务状态管理 Context
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { TestTask } from '@/types';

interface TaskContextType {
  tasks: TestTask[];
  addTask: (task: TestTask) => void;
  updateTask: (id: string, updates: Partial<TestTask>) => void;
  deleteTask: (id: string) => void;
  getTask: (id: string) => TestTask | undefined;
  clearTasks: () => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TestTask[]>([]);

  const addTask = useCallback((task: TestTask) => {
    setTasks(prev => [...prev, task]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<TestTask>) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id ? { ...task, ...updates, updatedAt: new Date() } : task
      )
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  }, []);

  const getTask = useCallback((id: string) => {
    return tasks.find(task => task.id === id);
  }, [tasks]);

  const clearTasks = useCallback(() => {
    setTasks([]);
  }, []);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        addTask,
        updateTask,
        deleteTask,
        getTask,
        clearTasks
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
