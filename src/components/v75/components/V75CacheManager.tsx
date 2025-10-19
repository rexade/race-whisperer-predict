
import React, { useState, useEffect } from 'react';
import { Trash2, Database, Clock, HardDrive } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { V75CacheService } from '../../../services/v75CacheService';

const V75CacheManager: React.FC = () => {
  const [cacheInfo, setCacheInfo] = useState<{ 
    raceIds: string[], 
    totalSize: number, 
    cacheEntries: Array<{ raceId: string; raceNumber: number; date: string; horseCount: number }> 
  }>({ raceIds: [], totalSize: 0, cacheEntries: [] });
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
      description: "All V75 raw times cache has been cleared.",
    });
  };

  const handleClearRace = (raceId: string) => {
    V75CacheService.clearRawTimes(raceId);
    refreshCacheInfo();
    
    toast({
      title: "Cache Cleared",
      description: `Raw times cache for race ${raceId} has been cleared.`,
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Group cache entries by date
  const groupedEntries = cacheInfo.cacheEntries.reduce((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = [];
    }
    acc[entry.date].push(entry);
    return acc;
  }, {} as Record<string, typeof cacheInfo.cacheEntries>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          V75 Raw Times Cache Manager
        </CardTitle>
        <CardDescription>
          Manage cached raw KM times for V75 races. Raw times are cached permanently since they never change.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cache Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Clock className="h-4 w-4 text-blue-600" />
            <div>
              <div className="text-sm font-medium">Cached Races</div>
              <div className="text-lg font-bold">{cacheInfo.raceIds.length}</div>
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
                {cacheInfo.raceIds.length > 0 ? 'Active' : 'Empty'}
              </div>
            </div>
          </div>
        </div>

        {/* Cached Races List */}
        {Object.keys(groupedEntries).length > 0 ? (
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Cached Raw Times by Date</h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {Object.entries(groupedEntries)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, entries]) => (
                <div key={date} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{date}</Badge>
                    <span className="text-sm text-gray-600">
                      {entries.length} races cached
                    </span>
                  </div>
                  <div className="ml-4 space-y-1">
                    {entries
                      .sort((a, b) => a.raceNumber - b.raceNumber)
                      .map(entry => (
                      <div key={entry.raceId} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Race {entry.raceNumber}
                          </Badge>
                          <span className="text-gray-600">
                            {entry.horseCount} horses
                          </span>
                          <span className="text-xs text-gray-500 font-mono">
                            {entry.raceId}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleClearRace(entry.raceId)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No cached raw times</p>
            <p className="text-sm">Analyze a V75 race to start caching raw times</p>
          </div>
        )}

        {/* Actions */}
        {cacheInfo.raceIds.length > 0 && (
          <div className="pt-4 border-t">
            <Button
              variant="destructive"
              onClick={handleClearAll}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Raw Times Cache
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Raw times are cached for 7 days (they never change once calculated)</p>
          <p>• Only computationally expensive raw KM times are cached</p>
          <p>• Fresh race data is fetched from API each time for latest information</p>
          <p>• Normalization weights are always applied to fresh race data</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default V75CacheManager;
