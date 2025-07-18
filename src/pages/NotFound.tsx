
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Home, Trophy } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-gray-900">404</h1>
          <h2 className="text-2xl font-semibold text-gray-700">Page Not Found</h2>
          <p className="text-gray-600">
            The page you're looking for doesn't exist in TrotAnalyzer.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/">
            <Button variant="default" className="w-full sm:w-auto">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </Link>
          
          <Link to="/v75-analyzer">
            <Button variant="outline" className="w-full sm:w-auto">
              <Trophy className="mr-2 h-4 w-4" />
              V75 Analyzer
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
