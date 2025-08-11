
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import SectionHeader from "@/components/shared/SectionHeader";

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
    <Card className={`border-0 shadow-none sm:border-border sm:shadow-md ${className}`}>
      <SectionHeader title={title} subtitle={description} icon={icon} />
      
      <CardContent className="space-y-3 sm:space-y-6">
        {children}
      </CardContent>
    </Card>
  );
};

export default AnalyzerCard;
