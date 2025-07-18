
import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            🏇 TrotAnalyzer
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Advanced V75 race analysis with intelligent caching and modern normalization algorithms.
            Analyze entire V75 days with precision and speed.
          </p>
          <div className="flex justify-center">
            <Link to="/v75-analyzer">
              <Button size="lg" className="text-lg px-8 py-4">
                <Trophy className="mr-2 h-6 w-6" />
                Start V75 Analysis
              </Button>
            </Link>
          </div>
        </div>

        {/* Main Feature Card */}
        <div className="max-w-4xl mx-auto">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-8">
              <div className="mx-auto mb-4 p-3 bg-purple-100 rounded-full w-fit">
                <Trophy className="h-8 w-8 text-purple-600" />
              </div>
              <CardTitle className="text-3xl font-bold text-gray-900">
                V75 Multi-Race Analyzer
              </CardTitle>
              <CardDescription className="text-lg text-gray-600 mt-4">
                Analyze all 7 races in a V75 day with advanced RAW time normalization, 
                intelligent caching, and comprehensive data validation.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-8">
              {/* Key Features */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-6 rounded-lg bg-blue-50">
                  <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">Date-Based Analysis</h3>
                  <p className="text-sm text-gray-600">
                    Select any V75 date and analyze all races with comprehensive data validation
                  </p>
                </div>
                
                <div className="text-center p-6 rounded-lg bg-green-50">
                  <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">Smart Caching</h3>
                  <p className="text-sm text-gray-600">
                    Intelligent caching system that speeds up analysis while maintaining accuracy
                  </p>
                </div>
                
                <div className="text-center p-6 rounded-lg bg-purple-50">
                  <Trophy className="h-8 w-8 text-purple-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">Modern Normalization</h3>
                  <p className="text-sm text-gray-600">
                    Advanced time normalization using RAW km times and comprehensive factor analysis
                  </p>
                </div>
              </div>

              {/* Technical Highlights */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Technical Features</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      RAW km time processing and normalization
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                      Comprehensive data validation and fixing
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                      Post position and equipment adjustments
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-orange-500 rounded-full mr-3"></div>
                      Driver performance analysis (2025 data)
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
                      Intelligent caching for performance
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-teal-500 rounded-full mr-3"></div>
                      Real-time progress tracking
                    </div>
                  </div>
                </div>
              </div>

              {/* Call to Action */}
              <div className="text-center pt-4">
                <Link to="/v75-analyzer">
                  <Button size="lg" variant="outline" className="text-lg px-8 py-4">
                    <Trophy className="mr-2 h-5 w-5" />
                    Open V75 Analyzer
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 text-gray-500">
          <p>© 2025 TrotAnalyzer - Advanced V75 Race Analysis Platform</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
