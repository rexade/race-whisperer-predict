/**
 * Enhanced logging utilities for time calculations and normalization
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  context?: string;
}

class EnhancedLogger {
  private logs: LogEntry[] = [];
  private maxLogEntries = 1000;
  private enabled = true;

  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Log a message with specified level
   */
  private log(level: LogLevel, category: string, message: string, data?: any, context?: string): void {
    if (!this.enabled) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      context
    };

    this.logs.push(entry);

    // Keep only the most recent entries
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }

    // Console output with color coding
    const color = this.getConsoleColor(level);
    const contextStr = context ? ` [${context}]` : '';
    console.log(`%c${level}%c [${category}]${contextStr}: ${message}`, color, 'color: inherit', data || '');
  }

  private getConsoleColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return 'color: #666';
      case LogLevel.INFO: return 'color: #2563eb';
      case LogLevel.WARN: return 'color: #d97706';
      case LogLevel.ERROR: return 'color: #dc2626';
      default: return 'color: inherit';
    }
  }

  /**
   * Debug level logging
   */
  debug(category: string, message: string, data?: any, context?: string): void {
    this.log(LogLevel.DEBUG, category, message, data, context);
  }

  /**
   * Info level logging
   */
  info(category: string, message: string, data?: any, context?: string): void {
    this.log(LogLevel.INFO, category, message, data, context);
  }

  /**
   * Warning level logging
   */
  warn(category: string, message: string, data?: any, context?: string): void {
    this.log(LogLevel.WARN, category, message, data, context);
  }

  /**
   * Error level logging
   */
  error(category: string, message: string, data?: any, context?: string): void {
    this.log(LogLevel.ERROR, category, message, data, context);
  }

  /**
   * Get logs by category
   */
  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Get summary statistics
   */
  getLogSummary(): { [key in LogLevel]: number } {
    const summary = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0
    };

    this.logs.forEach(log => {
      summary[log.level]++;
    });

    return summary;
  }
}

// Global logger instance
export const Logger = new EnhancedLogger();

/**
 * Time-specific logging utilities
 */
export class TimeLogger {
  /**
   * Log time conversion operations
   */
  static logTimeConversion(
    operation: string,
    input: any,
    output: any,
    context?: string
  ): void {
    Logger.debug('TIME_CONVERSION', `${operation}`, {
      input,
      output,
      operation
    }, context);
  }

  /**
   * Log normalization steps
   */
  static logNormalization(
    step: string,
    horseId: number,
    data: any,
    context?: string
  ): void {
    Logger.info('NORMALIZATION', `${step} for horse ${horseId}`, data, context);
  }

  /**
   * Log adjustment calculations
   */
  static logAdjustment(
    adjustmentType: string,
    value: number,
    factors: any,
    context?: string
  ): void {
    Logger.debug('ADJUSTMENT', `${adjustmentType}: ${value.toFixed(3)}s`, {
      adjustmentType,
      value,
      factors
    }, context);
  }

  /**
   * Log validation results
   */
  static logValidation(
    validationType: string,
    isValid: boolean,
    details: any,
    context?: string
  ): void {
    const level = isValid ? LogLevel.DEBUG : LogLevel.WARN;
    Logger.log(level, 'VALIDATION', `${validationType}: ${isValid ? 'VALID' : 'INVALID'}`, details, context);
  }

  /**
   * Log cache operations
   */
  static logCache(
    operation: string,
    cacheKey: string,
    hit: boolean,
    context?: string
  ): void {
    Logger.info('CACHE', `${operation}: ${hit ? 'HIT' : 'MISS'} for ${cacheKey}`, { operation, cacheKey, hit }, context);
  }

  /**
   * Log performance metrics
   */
  static logPerformance(
    operation: string,
    duration: number,
    details?: any,
    context?: string
  ): void {
    Logger.info('PERFORMANCE', `${operation}: ${duration}ms`, { operation, duration, ...details }, context);
  }
}
