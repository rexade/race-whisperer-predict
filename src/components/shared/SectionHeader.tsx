import React, { ReactNode } from "react";
import { CardHeader, CardTitle } from "@/components/ui/card";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType | React.ReactNode;
  actions?: ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, icon, actions }) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (typeof icon === "function") {
      const Comp = icon as React.ElementType;
      return <Comp className="h-5 w-5" />;
    }
    return icon as React.ReactNode;
  };

  return (
    <CardHeader className="bg-transparent border-none sm:bg-card sm:border-b animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 shadow-sm">
              {renderIcon()}
            </div>
          )}
          <div className="min-w-0">
            <CardTitle className="text-xl sm:text-2xl text-foreground font-semibold truncate">
              {title}
            </CardTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </CardHeader>
  );
};

export default SectionHeader;
