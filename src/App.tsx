import { ThemeProvider } from 'next-themes';
import V75Analyzer from './components/V75Analyzer';
import DebugErrorBoundary from './components/DebugErrorBoundary';
import { Toaster } from './components/ui/toaster';
import './App.css';

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <DebugErrorBoundary>
        <div className="min-h-screen bg-background font-primary">
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md">
            Skip to main content
          </a>

          <main id="main-content" className="relative z-10">
            <V75Analyzer />
          </main>

          <Toaster />
        </div>
      </DebugErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
