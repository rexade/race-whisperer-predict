import { ThemeProvider } from 'next-themes';
import V75Analyzer from './components/V75Analyzer';
import DebugErrorBoundary from './components/DebugErrorBoundary';
import { Toaster } from './components/ui/toaster';
import ThemeToggle from './components/ThemeToggle';
import './App.css';

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <DebugErrorBoundary>
        <div className="min-h-screen bg-background font-primary">
          <header className="bg-card border-b sticky top-0 z-50">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="flex items-center h-12 sm:h-16">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent rounded-lg flex items-center justify-center">
                    <span className="text-xl sm:text-2xl">🏇</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-semibold text-foreground font-secondary">
                    TrotAnalyzer
                  </h1>
                </div>
                <div className="ml-auto">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </header>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md">
            Skip to main content
          </a>
          <main id="main-content" className="container mx-auto px-0 sm:px-4 py-4 sm:py-8">
            <V75Analyzer />
          </main>
          <Toaster />
        </div>
      </DebugErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
