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
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 font-primary relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute top-1/2 -right-4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          </div>

          <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60 shadow-sm">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="flex items-center h-14 sm:h-16">
                <div className="flex items-center space-x-3 group">
                  <div className="relative w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-primary/30">
                    <span className="text-xl sm:text-2xl relative z-10">🏇</span>
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl blur-sm" />
                  </div>
                  <div className="flex flex-col">
                    <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent font-secondary tracking-tight">
                      TrotAnalyzer
                    </h1>
                    <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                      V75 Race Analysis
                    </p>
                  </div>
                </div>
                <div className="ml-auto">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </header>

          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-20 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg">
            Skip to main content
          </a>

          <main id="main-content" className="container mx-auto px-0 sm:px-4 py-6 sm:py-10 relative z-10">
            <V75Analyzer />
          </main>

          <Toaster />
        </div>
      </DebugErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
