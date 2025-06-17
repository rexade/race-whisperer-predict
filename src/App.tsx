
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SingleHorseTest from "./components/SingleHorseTest";
import ModernNormalizationAnalyzer from "./components/ModernNormalizationAnalyzer";
import Index from "./pages/Index";
import Navigation from "./components/Navigation";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Navigation />
        <Routes>
          <Route path="/" element={<ModernNormalizationAnalyzer />} />
          <Route path="/race-analyzer" element={<Index />} />
          <Route path="/single-horse" element={<SingleHorseTest />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
