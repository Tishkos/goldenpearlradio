import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Newspaper, ExternalLink } from "lucide-react";
import type { News } from "@/types/api-models";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface NewsSelectorProps {
  onNewsSelect: (news: News) => void;
}

export default function NewsSelector({ onNewsSelect }: NewsSelectorProps) {
  const [, setLocation] = useLocation();
  const [selectedNews, setSelectedNews] = useState<News | null>(null);

  // Fetch news
  const { data: news = [] } = useQuery({
    queryKey: ['news'],
    queryFn: async () => {
      const data = await api.get<News[]>('/news');
      return data || [];
    },
  });

  const handleNewsConfirm = () => {
    if (selectedNews) {
      onNewsSelect(selectedNews);
      toast.success("News selected!");
    }
  };

  const handleGoToNewsManager = () => {
    setLocation('/admin/breaking-news');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            News Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="news-select">Select News</Label>
              <Select
                value={selectedNews?.id.toString() || "none"}
                onValueChange={(value) => {
                  if (value === "none") {
                    setSelectedNews(null);
                  } else {
                    const newsItem = news.find(n => n.id.toString() === value);
                    setSelectedNews(newsItem || null);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose news" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No news</SelectItem>
                  {news.map((newsItem) => (
                    <SelectItem key={newsItem.id} value={newsItem.id.toString()}>
                      {newsItem.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGoToNewsManager}
              variant="outline"
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Manage News
            </Button>
          </div>

          {selectedNews && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-blue-900">{selectedNews.title}</h4>
                  <p className="text-sm text-blue-700 mt-1">{selectedNews.message?.substring(0, 100) || 'No description available'}...</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">
                      {new Date(selectedNews.createdAt).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
                <Button
                  onClick={handleGoToNewsManager}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Newspaper className="h-4 w-4" />
                  Manage News
                </Button>
              </div>
              <Button
                onClick={handleNewsConfirm}
                className="mt-3 w-full"
              >
                Confirm News Selection
              </Button>
            </div>
          )}

          {news.length === 0 && (
            <div className="text-center py-8">
              <Newspaper className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No News Available</h4>
              <p className="text-gray-500 mb-4">
                No news available. Go to news manager to create news!
              </p>
              <Button
                onClick={handleGoToNewsManager}
                variant="outline"
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Go to News Manager
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}