import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import V75Analyzer from './components/V75Analyzer.tsx'
import './index.css'

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4">
          <div className="flex items-center h-12 sm:h-16">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
              🏇 TrotAnalyzer
            </h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <V75Analyzer />
      </main>
    </div>
  </QueryClientProvider>
);
