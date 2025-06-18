
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AnalyzerCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const AnalyzerCard: React.FC<AnalyzerCardProps> = ({ 
  title, 
  description, 
  icon, 
  children, 
  className = "" 
}) => {
  return (
    <Card className={`border-purple-200 shadow-lg ${className}`}>
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
        <CardTitle className="text-2xl text-purple-800 flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <p className="text-purple-600">{description}</p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {children}
      </CardContent>
    </Card>
  );
};

export default AnalyzerCard;
