
import React from 'react';
import { CheckCircle, AlertCircle, XCircle } from "lucide-react";

interface StatusCardProps {
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  children: React.ReactNode;
}

const StatusCard: React.FC<StatusCardProps> = ({ type, title, children }) => {
  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50 border-green-200',
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          titleColor: 'text-green-800'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          icon: <AlertCircle className="h-5 w-5 text-yellow-600" />,
          titleColor: 'text-yellow-800'
        };
      case 'error':
        return {
          bg: 'bg-red-50 border-red-200',
          icon: <XCircle className="h-5 w-5 text-red-600" />,
          titleColor: 'text-red-800'
        };
      case 'info':
        return {
          bg: 'bg-blue-50 border-blue-200',
          icon: <AlertCircle className="h-5 w-5 text-blue-600" />,
          titleColor: 'text-blue-800'
        };
    }
  };

  const styles = getStyles();

  return (
    <div className={`${styles.bg} border rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {styles.icon}
        <h3 className={`font-semibold ${styles.titleColor}`}>{title}</h3>
      </div>
      {children}
    </div>
  );
};

export default StatusCard;
