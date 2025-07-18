
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link 
              to="/" 
              className="text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors"
            >
              🏇 TrotAnalyzer
            </Link>
            
            <div className="hidden md:flex space-x-6">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/') 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Home
              </Link>
              
              <Link
                to="/v75-analyzer"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/v75-analyzer') 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                V75 Analyzer
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
