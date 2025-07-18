
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { runTimeCalculationTests, TimeTestSuiteResult } from '../../../services/utils/timeCalculationTester';
import { Logger } from '../../../services/utils/enhancedLogging';

const V75TimeValidator: React.FC = () => {
  const [testResults, setTestResults] = useState<TimeTestSuiteResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logSummary, setLogSummary] = useState<any>(null);

  const runTests = async () => {
    setIsRunning(true);
    console.log('🧪 Starting comprehensive time calculation tests...');
    
    try {
      const results = runTimeCalculationTests();
      setTestResults(results);
      
      // Get logging summary
      const summary = Logger.getLogSummary();
      setLogSummary(summary);
      
    } catch (error) {
      console.error('Error running tests:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const clearLogs = () => {
    Logger.clearLogs();
    setLogSummary(Logger.getLogSummary());
  };

  const exportLogs = () => {
    const logs = Logger.exportLogs();
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-calculation-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    // Initialize log summary
    setLogSummary(Logger.getLogSummary());
  }, []);

  return (
    <Card className="border-blue-200 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Time Calculation Validator</span>
          <div className="flex gap-2">
            <Button 
              onClick={runTests} 
              disabled={isRunning}
              size="sm"
              variant="outline"
            >
              {isRunning ? 'Running Tests...' : 'Run Tests'}
            </Button>
            <Button 
              onClick={clearLogs} 
              size="sm"
              variant="outline"
            >
              Clear Logs
            </Button>
            <Button 
              onClick={exportLogs} 
              size="sm"
              variant="outline"
            >
              Export Logs
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Logging Summary */}
        {logSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{logSummary.DEBUG}</div>
              <div className="text-sm text-gray-500">Debug</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{logSummary.INFO}</div>
              <div className="text-sm text-gray-500">Info</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{logSummary.WARN}</div>
              <div className="text-sm text-gray-500">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{logSummary.ERROR}</div>
              <div className="text-sm text-gray-500">Errors</div>
            </div>
          </div>
        )}

        {/* Test Results */}
        {testResults && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Test Results</h3>
              <Badge 
                variant={testResults.failedTests === 0 ? "default" : "destructive"}
                className="text-sm"
              >
                {testResults.summary}
              </Badge>
            </div>

            {/* Overall Statistics */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-700">{testResults.totalTests}</div>
                <div className="text-sm text-gray-500">Total Tests</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{testResults.passedTests}</div>
                <div className="text-sm text-gray-500">Passed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{testResults.failedTests}</div>
                <div className="text-sm text-gray-500">Failed</div>
              </div>
            </div>

            {/* Failed Tests Details */}
            {testResults.failedTests > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-red-600">Failed Tests:</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {testResults.results
                    .filter(result => !result.passed)
                    .map((result, index) => (
                      <div key={index} className="bg-red-50 border border-red-200 rounded p-3">
                        <div className="font-medium text-red-800">{result.testCase.name}</div>
                        <div className="text-sm text-red-600 mt-1">
                          Expected: {result.testCase.expected.minutes}:
                          {result.testCase.expected.seconds.toString().padStart(2, '0')}.
                          {result.testCase.expected.tenths}
                        </div>
                        <div className="text-sm text-red-600">
                          Actual: {result.actual.minutes}:
                          {result.actual.seconds.toString().padStart(2, '0')}.
                          {result.actual.tenths}
                        </div>
                        <div className="text-sm text-red-600">
                          Difference: {result.actualDifference.toFixed(3)}s
                        </div>
                        {result.error && (
                          <div className="text-sm text-red-700 mt-1">
                            Error: {result.error}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Passed Tests Summary */}
            {testResults.passedTests > 0 && (
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <div className="font-medium text-green-800">
                  ✅ {testResults.passedTests} tests passed successfully
                </div>
                <div className="text-sm text-green-600 mt-1">
                  All time calculations are working correctly within expected tolerances.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="font-medium text-blue-800">How to Use:</div>
          <ul className="text-sm text-blue-600 mt-1 space-y-1">
            <li>• Click "Run Tests" to validate all time calculation functions</li>
            <li>• Monitor the log summary to track system activity</li>
            <li>• Export logs for detailed analysis and debugging</li>
            <li>• Failed tests indicate potential issues that need attention</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default V75TimeValidator;
