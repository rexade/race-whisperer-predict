
import { useState } from 'react';

export interface V75ProgressState {
  loading: boolean;
  progress: number;
  currentTask: string;
  error: string;
}

export const useV75Progress = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [error, setError] = useState("");

  const startProgress = () => {
    setLoading(true);
    setError("");
    setProgress(0);
  };

  const updateProgress = (newProgress: number, task: string) => {
    setProgress(newProgress);
    setCurrentTask(task);
  };

  const setErrorState = (errorMessage: string) => {
    setError(errorMessage);
  };

  const finishProgress = (delay: number = 1000) => {
    setProgress(100);
    setCurrentTask("Analysis complete!");
    setTimeout(() => setLoading(false), delay);
  };

  const resetProgress = () => {
    setLoading(false);
    setProgress(0);
    setCurrentTask("");
    setError("");
  };

  return {
    loading,
    progress,
    currentTask,
    error,
    startProgress,
    updateProgress,
    setErrorState,
    finishProgress,
    resetProgress
  };
};
