
import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class DebugErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('🚨 ERROR BOUNDARY CAUGHT:', error);
    console.error('🚨 ERROR MESSAGE:', error.message);
    console.error('🚨 ERROR STACK:', error.stack);
    
    if (error.message.includes('Objects are not valid as a React child')) {
      console.error('🚨 REACT CHILD OBJECT ERROR DETECTED!');
      console.error('🚨 This means an object is being rendered directly in JSX');
      console.error('🚨 Look for places where {id, name} objects are used');
    }
    
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 ERROR BOUNDARY - Component stack:', errorInfo.componentStack);
    console.error('🚨 ERROR BOUNDARY - Error boundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-xl font-bold text-red-800 mb-4">Error Detected</h2>
          <p className="text-red-700 mb-2">
            <strong>Error:</strong> {this.state.error?.message}
          </p>
          <details className="mt-4">
            <summary className="cursor-pointer text-red-600 font-medium">Stack Trace</summary>
            <pre className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto">
              {this.state.error?.stack}
            </pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DebugErrorBoundary;
