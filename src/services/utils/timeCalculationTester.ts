
import { KmTime, kmTimeToSeconds, secondsToKmTime, addSecondsToKmTime } from './kmTimeUtils';
import { validateKmTime, validateNormalizationResult } from './timeValidation';

/**
 * Test case for time calculations
 */
export interface TimeTestCase {
  name: string;
  input: KmTime;
  adjustment: number;
  expected: KmTime;
  tolerance: number; // seconds
}

/**
 * Test result for a single test case
 */
export interface TimeTestResult {
  testCase: TimeTestCase;
  actual: KmTime;
  passed: boolean;
  error?: string;
  actualDifference: number;
}

/**
 * Comprehensive test suite results
 */
export interface TimeTestSuiteResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: TimeTestResult[];
  summary: string;
}

/**
 * Standard test cases for time calculations
 */
export const STANDARD_TIME_TESTS: TimeTestCase[] = [
  {
    name: "Basic addition - positive adjustment",
    input: { minutes: 1, seconds: 15, tenths: 5 },
    adjustment: 2.3,
    expected: { minutes: 1, seconds: 17, tenths: 8 },
    tolerance: 0.1
  },
  {
    name: "Basic addition - negative adjustment",
    input: { minutes: 1, seconds: 20, tenths: 0 },
    adjustment: -1.5,
    expected: { minutes: 1, seconds: 18, tenths: 5 },
    tolerance: 0.1
  },
  {
    name: "Carry over seconds",
    input: { minutes: 1, seconds: 58, tenths: 7 },
    adjustment: 2.5,
    expected: { minutes: 2, seconds: 1, tenths: 2 },
    tolerance: 0.1
  },
  {
    name: "Carry over tenths",
    input: { minutes: 1, seconds: 30, tenths: 8 },
    adjustment: 0.3,
    expected: { minutes: 1, seconds: 31, tenths: 1 },
    tolerance: 0.1
  },
  {
    name: "Large positive adjustment",
    input: { minutes: 1, seconds: 10, tenths: 0 },
    adjustment: 15.7,
    expected: { minutes: 1, seconds: 25, tenths: 7 },
    tolerance: 0.1
  },
  {
    name: "Precision test - small adjustment",
    input: { minutes: 1, seconds: 15, tenths: 0 },
    adjustment: 0.05,
    expected: { minutes: 1, seconds: 15, tenths: 1 }, // Rounded to nearest tenth
    tolerance: 0.1
  },
  {
    name: "Zero adjustment",
    input: { minutes: 1, seconds: 25, tenths: 3 },
    adjustment: 0,
    expected: { minutes: 1, seconds: 25, tenths: 3 },
    tolerance: 0.1
  }
];

/**
 * Runs a single time calculation test
 */
export const runTimeTest = (testCase: TimeTestCase): TimeTestResult => {
  try {
    // Validate input
    const inputValidation = validateKmTime(testCase.input, 'Test input');
    if (!inputValidation.isValid) {
      return {
        testCase,
        actual: testCase.input,
        passed: false,
        error: `Invalid input: ${inputValidation.errors.join(', ')}`,
        actualDifference: 0
      };
    }

    // Perform the calculation
    const actual = addSecondsToKmTime(testCase.input, testCase.adjustment);
    
    // Calculate the difference
    const expectedSeconds = kmTimeToSeconds(testCase.expected);
    const actualSeconds = kmTimeToSeconds(actual);
    const difference = Math.abs(actualSeconds - expectedSeconds);
    
    // Check if within tolerance
    const passed = difference <= testCase.tolerance;
    
    return {
      testCase,
      actual,
      passed,
      actualDifference: actualSeconds - expectedSeconds
    };
    
  } catch (error) {
    return {
      testCase,
      actual: testCase.input,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      actualDifference: 0
    };
  }
};

/**
 * Runs the complete test suite
 */
export const runTimeCalculationTests = (
  customTests: TimeTestCase[] = []
): TimeTestSuiteResult => {
  const allTests = [...STANDARD_TIME_TESTS, ...customTests];
  const results: TimeTestResult[] = [];
  
  console.log(`🧪 Running ${allTests.length} time calculation tests...`);
  
  for (const testCase of allTests) {
    const result = runTimeTest(testCase);
    results.push(result);
    
    if (result.passed) {
      console.log(`✅ ${testCase.name}: PASSED`);
    } else {
      console.log(`❌ ${testCase.name}: FAILED`);
      console.log(`   Expected: ${testCase.expected.minutes}:${testCase.expected.seconds.toString().padStart(2, '0')}.${testCase.expected.tenths}`);
      console.log(`   Actual: ${result.actual.minutes}:${result.actual.seconds.toString().padStart(2, '0')}.${result.actual.tenths}`);
      console.log(`   Difference: ${result.actualDifference.toFixed(3)}s`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  }
  
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.filter(r => !r.passed).length;
  
  const summary = `Time Calculation Tests: ${passedTests}/${allTests.length} passed (${((passedTests / allTests.length) * 100).toFixed(1)}%)`;
  
  console.log(`\n📊 ${summary}`);
  
  return {
    totalTests: allTests.length,
    passedTests,
    failedTests,
    results,
    summary
  };
};

/**
 * Creates a test case from normalization data
 */
export const createNormalizationTestCase = (
  name: string,
  rawTime: KmTime,
  adjustment: number,
  expectedTime: KmTime,
  tolerance: number = 0.1
): TimeTestCase => {
  return {
    name: `Normalization: ${name}`,
    input: rawTime,
    adjustment,
    expected: expectedTime,
    tolerance
  };
};
