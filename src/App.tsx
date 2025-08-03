
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import V75Analyzer from './components/V75Analyzer';
import { ModernAnalyzer } from './components/ModernAnalyzer';
import { EnhancedModernAnalyzer } from './components/modernAnalyzer/EnhancedModernAnalyzer';
import DebugErrorBoundary from './components/DebugErrorBoundary';
import { Toaster } from './components/ui/toaster';
import './App.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DebugErrorBoundary>
        <div className="min-h-screen bg-background">
          <header className="bg-card shadow-sm border-b sticky top-0 z-50">
            <div className="container mx-auto px-2 sm:px-4">
              <div className="flex items-center h-12 sm:h-16">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                  🏇 TrotAnalyzer
                </h1>
              </div>
            </div>
          </header>
          <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
            {/* Debug: Testing tab visibility */}
            <div className="bg-red-500 text-white p-4 mb-4 rounded">
              DEBUGGING: Can you see this red box? If yes, tabs should appear below.
            </div>
            
            <Tabs defaultValue="v75" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6 bg-blue-500 p-2 rounded">
                <TabsTrigger value="v75" className="bg-white text-black">V75 Analyzer</TabsTrigger>
                <TabsTrigger value="modern" className="bg-white text-black">Modern KM Analyzer</TabsTrigger>
                <TabsTrigger value="enhanced" className="bg-white text-black">Enhanced Control</TabsTrigger>
              </TabsList>
              <TabsContent value="v75">
                <V75Analyzer />
              </TabsContent>
              <TabsContent value="modern">
                <ModernAnalyzer />
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
