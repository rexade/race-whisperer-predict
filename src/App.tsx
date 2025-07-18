
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import V75Analyzer from './components/V75Analyzer';
import './App.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4">
            <div className="flex items-center h-16">
              <h1 className="text-xl font-bold text-gray-900">
                🏇 TrotAnalyzer - V75 Analysis
              </h1>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <V75Analyzer />
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
