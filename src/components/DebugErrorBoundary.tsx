
import React, { Component, ReactNode } from 'react';
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error('ERROR BOUNDARY CAUGHT:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ERROR BOUNDARY - Component stack:', errorInfo.componentStack);
    console.error('ERROR BOUNDARY - Error boundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="p-8 bg-destructive/10 border border-destructive/30 rounded-lg"
        >
          <h2 className="text-xl font-bold text-destructive mb-4">Error Detected</h2>
          <p className="text-destructive/90 mb-2">
            <strong>Error:</strong> {this.state.error?.message}
          </p>
          <details className="mt-4">
            <summary className="cursor-pointer text-destructive font-medium">Stack Trace</summary>
            <pre className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded overflow-auto">
              {this.state.error?.stack}
            </pre>
          </details>
          <Button
            variant="destructive"
            className="mt-4"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DebugErrorBoundary;
