
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
          bg: 'bg-success/10 dark:bg-success/20 border-success/30 dark:border-success/40',
          icon: <CheckCircle className="h-5 w-5 text-success" />,
          titleColor: 'text-success dark:text-success'
        };
      case 'warning':
        return {
          bg: 'bg-warning/10 dark:bg-warning/20 border-warning/30 dark:border-warning/40',
          icon: <AlertCircle className="h-5 w-5 text-warning" />,
          titleColor: 'text-warning dark:text-warning'
        };
      case 'error':
        return {
          bg: 'bg-destructive/10 dark:bg-destructive/20 border-destructive/30 dark:border-destructive/40',
          icon: <XCircle className="h-5 w-5 text-destructive" />,
          titleColor: 'text-destructive dark:text-destructive'
        };
      case 'info':
        return {
          bg: 'bg-primary/10 dark:bg-primary/20 border-primary/30 dark:border-primary/40',
          icon: <AlertCircle className="h-5 w-5 text-primary" />,
          titleColor: 'text-primary dark:text-primary'
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
      <div className="text-foreground dark:text-foreground">
        {children}
      </div>
    </div>
  );
};

export default StatusCard;
