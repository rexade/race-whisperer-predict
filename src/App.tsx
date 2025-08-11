
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import V75Analyzer from './components/V75Analyzer';
import { EnhancedModernAnalyzer } from './components/modernAnalyzer/EnhancedModernAnalyzer';
import DebugErrorBoundary from './components/DebugErrorBoundary';
import { Toaster } from './components/ui/toaster';
import './App.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DebugErrorBoundary>
        <div className="min-h-screen bg-background font-primary">
          <header className="bg-card border-b">
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
              </div>
            </div>
          </header>
          <main className="container mx-auto px-0 sm:px-4 py-4 sm:py-8">
            <Tabs defaultValue="v75" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="v75">V75 Analyzer</TabsTrigger>
                <TabsTrigger value="enhanced">Enhanced Control</TabsTrigger>
              </TabsList>
              <TabsContent value="v75">
                <V75Analyzer />
              </TabsContent>
              <TabsContent value="enhanced">
                <EnhancedModernAnalyzer />
              </TabsContent>
            </Tabs>
          </main>
          <Toaster />
        </div>
      </DebugErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
