
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar, Trophy } from "lucide-react";

const Navigation: React.FC = () => {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `${isActive 
      ? 'bg-purple-100 text-purple-700 border-purple-300' 
      : 'text-gray-600 border-gray-200 hover:bg-gray-50'
    } border rounded-lg px-4 py-2 transition-colors`;

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-purple-600" />
            <h1 className="text-xl font-bold text-gray-800">Race Whisperer</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <NavLink to="/" className={navLinkClass}>
              <Button variant="ghost" className="flex items-center gap-2 p-0">
                <Sparkles className="h-4 w-4" />
                Modern Analyzer
              </Button>
            </NavLink>
            
            <NavLink to="/v75-analyzer" className={navLinkClass}>
              <Button variant="ghost" className="flex items-center gap-2 p-0">
                <Trophy className="h-4 w-4" />
                V75 Analyzer
              </Button>
            </NavLink>
            
            <NavLink to="/race-analyzer" className={navLinkClass}>
              <Button variant="ghost" className="flex items-center gap-2 p-0">
                <Calendar className="h-4 w-4" />
                Race Analyzer
              </Button>
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
