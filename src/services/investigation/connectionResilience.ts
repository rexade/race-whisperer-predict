/**
 * Connection Resilience Utility
 * 
 * Provides robust connection handling with retry logic,
 * timeout management, and comprehensive logging for debugging
 * network-related issues in Xander investigations.
 */

import { EnhancedXanderDebugger } from './enhancedXanderDebugger';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  backoffMultiplier: number;
  timeout: number; // in milliseconds
}

interface ConnectionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  totalTime: number;
}

export class ConnectionResilience {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    timeout: 15000
  };
  
  /**
   * Execute a function with retry logic and connection resilience
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: {
      horseName: string;
      operationName: string;
      url?: string;
    },
    config: Partial<RetryConfig> = {}
  ): Promise<ConnectionResult<T>> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const startTime = Date.now();
    let lastError = '';
    
    EnhancedXanderDebugger.addCheckpoint(
      'connection_start',
      'network',
      context.horseName,
      { operation: context.operationName, url: context.url },
      true
    );
    
    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      const attemptStartTime = Date.now();
      
      try {
        // Execute with timeout
        const result = await Promise.race([
          operation(),
          this.createTimeoutPromise<T>(finalConfig.timeout)
        ]);
        
        const responseTime = Date.now() - attemptStartTime;
        const totalTime = Date.now() - startTime;
        
        EnhancedXanderDebugger.logConnectionAttempt(
          context.horseName,
          context.url || context.operationName,
          true,
          responseTime,
          undefined,
          attempt
        );
        
        EnhancedXanderDebugger.addCheckpoint(
          'connection_success',
          'network',
          context.horseName,
          {
            operation: context.operationName,
            attempts: attempt + 1,
            totalTime,
            responseTime
          },
          true
        );
        
        return {
          success: true,
          data: result,
          attempts: attempt + 1,
          totalTime
        };
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        lastError = errorMessage;
        const responseTime = Date.now() - attemptStartTime;
        
        EnhancedXanderDebugger.logConnectionAttempt(
          context.horseName,
          context.url || context.operationName,
          false,
          responseTime,
          errorMessage,
          attempt
        );
        
        // Don't retry on the last attempt
        if (attempt === finalConfig.maxRetries) {
          break;
        }
        
        // Calculate delay for next attempt
        const delay = Math.min(
          finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
          finalConfig.maxDelay
        );
        
        console.log(`🔄 Retrying ${context.operationName} in ${delay}ms (attempt ${attempt + 1}/${finalConfig.maxRetries + 1})`);
        
        EnhancedXanderDebugger.logErrorRecovery(
          context.horseName,
          'connection_error',
          `Retrying after ${delay}ms delay`,
          false
        );
        
        await this.sleep(delay);
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    EnhancedXanderDebugger.addCheckpoint(
      'connection_failed',
      'network',
      context.horseName,
      {
        operation: context.operationName,
        attempts: finalConfig.maxRetries + 1,
        totalTime,
        finalError: lastError
      },
      false,
      lastError
    );
    
    return {
      success: false,
      error: lastError,
      attempts: finalConfig.maxRetries + 1,
      totalTime
    };
  }
  
  /**
   * Enhanced fetch with retry logic and debugging
   */
  static async resilientFetch(
    url: string,
    options: RequestInit = {},
    context: {
      horseName: string;
      operationName: string;
    },
    config?: Partial<RetryConfig>
  ): Promise<ConnectionResult<Response>> {
    return this.executeWithRetry(
      async () => {
        const response = await fetch(url, {
          ...options,
          headers: {
            'User-Agent': 'V75Analyzer/1.0 (Debug Mode)',
            ...options.headers
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      },
      {
        ...context,
        url
      },
      config
    );
  }
  
  /**
   * Enhanced API call with JSON parsing and retry logic
   */
  static async resilientApiCall<T>(
    url: string,
    options: RequestInit = {},
    context: {
      horseName: string;
      operationName: string;
    },
    config?: Partial<RetryConfig>
  ): Promise<ConnectionResult<T>> {
    const fetchResult = await this.resilientFetch(url, options, context, config);
    
    if (!fetchResult.success) {
      return {
        success: false,
        error: fetchResult.error,
        attempts: fetchResult.attempts,
        totalTime: fetchResult.totalTime
      };
    }
    
    try {
      const data = await fetchResult.data!.json();
      
      EnhancedXanderDebugger.logProcessingPhase(
        context.horseName,
        'json_parsing',
        {
          operation: context.operationName,
          dataSize: JSON.stringify(data).length
        }
      );
      
      return {
        success: true,
        data,
        attempts: fetchResult.attempts,
        totalTime: fetchResult.totalTime
      };
      
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      
      EnhancedXanderDebugger.addCheckpoint(
        'json_parse_failed',
        'data_processing',
        context.horseName,
        { operation: context.operationName },
        false,
        errorMessage
      );
      
      return {
        success: false,
        error: `JSON parsing failed: ${errorMessage}`,
        attempts: fetchResult.attempts,
        totalTime: fetchResult.totalTime
      };
    }
  }
  
  private static createTimeoutPromise<T>(timeout: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout);
    });
  }
  
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Test connection resilience with a simple ping
   */
  static async testConnection(
    baseUrl: string,
    horseName: string
  ): Promise<boolean> {
    const result = await this.resilientFetch(
      `${baseUrl}/health`,
      { method: 'HEAD' },
      {
        horseName,
        operationName: 'connection_test'
      },
      { maxRetries: 1, timeout: 5000 }
    );
    
    return result.success;
  }
}