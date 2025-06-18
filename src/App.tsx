
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Navigation from './components/Navigation';
import Index from './pages/Index';
import RaceAnalyzer from './components/RaceAnalyzer';
import ModernNormalizationAnalyzer from './components/ModernNormalizationAnalyzer';
import V75Analyzer from './components/V75Analyzer';
import V75PostRaceAnalysisPage from './pages/V75PostRaceAnalysis';
import NotFound from './pages/NotFound';
import './App.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/race-analyzer" element={<RaceAnalyzer />} />
              <Route path="/modern-analyzer" element={<ModernNormalizationAnalyzer />} />
              <Route path="/v75-analyzer" element={<V75Analyzer />} />
              <Route path="/v75-post-analysis" element={<V75PostRaceAnalysisPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
