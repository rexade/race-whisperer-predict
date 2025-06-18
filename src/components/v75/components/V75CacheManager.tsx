
import React, { useState, useEffect } from 'react';
import { Trash2, Database, Clock, HardDrive } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { V75CacheService } from '../../../services/v75CacheService';

const V75CacheManager: React.FC = () => {
  const [cacheInfo, setCacheInfo] = useState<{ dates: string[], totalSize: number }>({ dates: [], totalSize: 0 });
  const { toast } = useToast();

  const refreshCacheInfo = () => {
    const info = V75CacheService.getCacheInfo();
    setCacheInfo(info);
  };

  useEffect(() => {
    refreshCacheInfo();
  }, []);

  const handleClearAll = () => {
    V75CacheService.clearAllCache();
    refreshCacheInfo();
    
    toast({
      title: "Cache Cleared",
      description: "All V75 analysis cache has been cleared.",
    });
  };

  const handleClearDate = (date: string) => {
    V75CacheService.clearAnalysis(date);
    refreshCacheInfo();
    
    toast({
      title: "Cache Cleared",
      description: `Cache for ${date} has been cleared.`,
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          V75 Cache Manager
        </CardTitle>
        <CardDescription>
          Manage stored V75 analysis data to improve loading performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cache Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Clock className="h-4 w-4 text-blue-600" />
            <div>
              <div className="text-sm font-medium">Cached Dates</div>
              <div className="text-lg font-bold">{cacheInfo.dates.length}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <HardDrive className="h-4 w-4 text-green-600" />
            <div>
              <div className="text-sm font-medium">Storage Used</div>
              <div className="text-lg font-bold">{formatSize(cacheInfo.totalSize)}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Database className="h-4 w-4 text-purple-600" />
            <div>
              <div className="text-sm font-medium">Status</div>
              <div className="text-lg font-bold">
                {cacheInfo.dates.length > 0 ? 'Active' : 'Empty'}
              </div>
            </div>
          </div>
        </div>

        {/* Cached Dates List */}
        {cacheInfo.dates.length > 0 ? (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Cached V75 Analyses</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cacheInfo.dates.sort().reverse().map(date => (
                <div key={date} className="flex items-center justify-between p-2 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{date}</Badge>
                    <span className="text-sm text-gray-600">
                      Raw times pre-calculated
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleClearDate(date)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No cached V75 analyses</p>
            <p className="text-sm">Analyze a V75 date to start caching</p>
          </div>
        )}

        {/* Actions */}
        {cacheInfo.dates.length > 0 && (
          <div className="pt-4 border-t">
            <Button
              variant="destructive"
              onClick={handleClearAll}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Cache
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Cache automatically expires after 24 hours</p>
          <p>• Raw times are permanently stored and never recalculated</p>
          <p>• Only normalization weights are reapplied when changed</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default V75CacheManager;
