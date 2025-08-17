'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  PlayCircle,
  StopCircle,
  Download,
  Search,
  TrendingUp,
  Settings,
  Database,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  BookOpen
} from 'lucide-react';

interface Category {
  id: number;
  name: string;
  url: string;
  bestseller_url?: string;
  status: string;
  last_crawled?: string;
}

interface Product {
  id: number;
  title: string;
  isbn?: string;
  price?: number;
  original_price?: number;
  category_name?: string;
  page_number: number;
  rank_in_page: number;
  in_stock: boolean;
  product_url: string;
  last_updated: string;
}

interface ProductLink {
  id: number;
  url: string;
  category_id: number;
  category_name?: string;
  page_number: number;
  rank_in_page: number;
  crawled: boolean;
  created_at: string;
}

interface CrawlProgress {
  category: string;
  currentPage: number;
  totalPages: number;
  currentProduct: number;
  totalProducts: number;
  successfulProducts: number;
  failedProducts: number;
  status: string;
}

export default function Dashboard() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productLinks, setProductLinks] = useState<ProductLink[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null);
  const [isCrawling, setIsCrawling] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  // Track server logs to avoid duplicates
  const [lastServerLogCount, setLastServerLogCount] = useState(0);
  const [lastBatchLogCount, setLastBatchLogCount] = useState(0);
  const [settings, setSettings] = useState({
    threads: 10,
    startPage: 1,
    endPage: 50,
    forceRecrawl: false,
    batchThreads: 20,
    batchPages: 5
  });

  const [batchProgress, setBatchProgress] = useState<any>(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // Product Links state
  const [linksStats, setLinksStats] = useState<any>(null);
  const [linksFilter, setLinksFilter] = useState({
    categoryId: 'all',
    crawled: 'all',
    page: 1
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-199), `[${timestamp}] ${message}`]);
  };

  // Merge logs coming from server (already time-stamped)
  const mergeServerLogs = useCallback((serverLogs: string[] | undefined) => {
    if (!serverLogs || serverLogs.length === 0) return;

    // Only append new logs that we haven't seen before
    const newLogs = serverLogs.slice(lastServerLogCount);
    if (newLogs.length > 0) {
      setLogs(prev => [...prev, ...newLogs].slice(-300));
      setLastServerLogCount(serverLogs.length);
    }
  }, [lastServerLogCount]);

  // Merge batch logs (detailed worker logs)
  const mergeBatchLogs = useCallback((batchLogs: string[] | undefined) => {
    if (!batchLogs || batchLogs.length === 0) return;

    // Only append new logs that we haven't seen before
    const newLogs = batchLogs.slice(lastBatchLogCount);
    if (newLogs.length > 0) {
      setLogs(prev => [...prev, ...newLogs].slice(-300));
      setLastBatchLogCount(batchLogs.length);
    }
  }, [lastBatchLogCount]);

  const loadCategories = useCallback(async () => {
    try {
      addLog('🔄 Đang tải danh sách categories từ database...');
      console.log('🔄 Loading categories from API...');

      const response = await fetch('/api/categories');
      console.log('📡 API Response status:', response.status);

      const result = await response.json();
      console.log('📊 API Result:', result);

      if (result.success) {
        setCategories(result.data);
        addLog(`✅ Đã tải ${result.data.length} categories từ database`);
        console.log('✅ Categories loaded successfully:', result.data.length);
      } else {
        addLog(`❌ API trả về lỗi: ${result.error}`);
        console.error('❌ API Error:', result.error);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      addLog(`❌ Lỗi khi tải categories: ${error}`);
    }
  }, []);

  useEffect(() => {
    console.log('🚀 Dashboard mounted...');
    loadCategories();
    loadProductLinks();
    checkCrawlStatus();
    checkBatchStatus();

    // Poll for crawl and batch progress
    const interval = setInterval(() => {
      checkCrawlStatus();
      checkBatchStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [loadCategories]);

  // Debug effect to log categories state changes
  useEffect(() => {
    console.log('📊 Categories state updated:', categories.length, 'categories');
    if (categories.length > 0) {
      console.log('📋 First 3 categories:', categories.slice(0, 3));
    }
  }, [categories]);

  // Reload product links when filter changes
  useEffect(() => {
    if (categories.length > 0) {
      loadProductLinks();
    }
  }, [linksFilter]);



  const testHealthCheck = async () => {
    setIsTesting(true);
    addLog('🏥 Testing API health check...');

    try {
      const response = await fetch('/api/health');
      const result = await response.json();

      if (result.success) {
        addLog(`✅ Health check successful!`);
        addLog(`🌐 Environment: ${result.environment}`);
        addLog(`💻 Platform: ${result.platform}`);
        addLog(`📦 Node: ${result.nodeVersion}`);
        addLog(`⏰ Timestamp: ${result.timestamp}`);

        setDebugInfo({
          ...debugInfo,
          healthCheck: result
        });
      } else {
        addLog(`❌ Health check failed: ${result.error}`);
      }
    } catch (error) {
      addLog(`❌ Health check error: ${error}`);
    } finally {
      setIsTesting(false);
    }
  };

  const loadProducts = async (categoryId?: number, search?: string) => {
    try {
      const params = new URLSearchParams();
      if (categoryId) params.append('categoryId', categoryId.toString());
      if (search) params.append('search', search);

      addLog('Đang tải danh sách products...');
      const response = await fetch(`/api/products?${params}`);
      const result = await response.json();
      if (result.success) {
        setProducts(result.data.products);
        addLog(`Đã tải ${result.data.products.length} products`);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      addLog(`Lỗi khi tải products: ${error}`);
    }
  };

  const loadProductLinks = async () => {
    try {
      const params = new URLSearchParams();
      if (linksFilter.categoryId !== 'all') {
        params.append('categoryId', linksFilter.categoryId);
      }
      if (linksFilter.crawled !== 'all') {
        params.append('crawled', linksFilter.crawled);
      }
      params.append('page', linksFilter.page.toString());
      params.append('limit', '100');

      addLog(`🔗 Đang tải product links... (categoryId: ${linksFilter.categoryId})`);
      console.log(`🔗 Loading product links with params:`, params.toString());

      const response = await fetch(`/api/product-links?${params}`);
      const result = await response.json();

      console.log(`📊 Product Links API Response:`, result);

      if (result.success) {
        setProductLinks(result.data.links);
        setLinksStats(result.data.stats);
        addLog(`✅ Đã tải ${result.data.links.length} product links (Total: ${result.data.stats.total})`);
      }
    } catch (error) {
      console.error('Failed to load product links:', error);
      addLog(`❌ Lỗi khi tải product links: ${error}`);
    }
  };

  const checkCrawlStatus = async () => {
    try {
      const response = await fetch('/api/crawl');
      const result = await response.json();
      if (result.success) {
        setIsCrawling(result.data.isRunning);
        setCrawlProgress(result.data.progress);
        // Merge server logs into UI
        mergeServerLogs(result.data.logs);
      }
    } catch (error) {
      console.error('Failed to check crawl status:', error);
    }
  };

  const checkBatchStatus = async () => {
    try {
      const response = await fetch('/api/batch');
      const result = await response.json();
      if (result.success) {
        const wasRunning = isBatchRunning;
        const newIsRunning = result.data.isRunning;

        setIsBatchRunning(newIsRunning);
        setBatchProgress(result.data.progress);

        // Merge detailed batch logs into UI
        mergeBatchLogs(result.data.logs);

        // Log status changes
        if (wasRunning && !newIsRunning) {
          console.log('🏁 [FRONTEND] Batch operation completed!');
          addLog('🏁 Batch operation đã hoàn thành!');
        }

        if (result.data.progress && newIsRunning) {
          const progress = result.data.progress;
          console.log(`📊 [FRONTEND] Batch Progress: ${progress.completed + progress.failed}/${progress.total} (${progress.completed} ✅, ${progress.failed} ❌) - Current: ${progress.current}`);

          // Add detailed progress to logs every 10 updates
          if ((progress.completed + progress.failed) % 10 === 0 && progress.completed + progress.failed > 0) {
            addLog(`📈 Tiến trình: ${progress.completed + progress.failed}/${progress.total} categories (${progress.completed} thành công, ${progress.failed} thất bại)`);
          }
        }
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Failed to check batch status:', error);
    }
  };

  const crawlCategories = async () => {
    setIsLoading(true);
    addLog('Bắt đầu crawl categories từ Barnes & Noble...');

    try {
      addLog('📤 Đang gửi request tới /api/categories...');

      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crawl' })
      });

      addLog(`📥 Nhận response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      addLog(`🔍 Response data: ${JSON.stringify(result).substring(0, 200)}...`);
      if (result.success) {
        addLog(`✅ Crawl thành công! Tìm thấy ${result.data.length} categories`);
        result.data.forEach((cat: Category) => {
          addLog(`📁 ${cat.name} - ${cat.url}`);
        });
        await loadCategories();
      } else {
        addLog(`❌ Crawl thất bại: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to crawl categories:', error);
      addLog(`❌ Lỗi crawl categories: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const findBestsellers = async (categoryId: number, categoryUrl: string) => {
    addLog(`🔍 Đang tìm bestseller link cho: ${categoryUrl}`);

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'find_bestsellers',
          categoryId,
          categoryUrl
        })
      });

      const result = await response.json();
      if (result.success && result.data.bestsellerUrl) {
        addLog(`✅ Tìm thấy bestseller URL: ${result.data.bestsellerUrl}`);
        await loadCategories();
      } else {
        addLog(`❌ Không tìm thấy bestseller link`);
      }
    } catch (error) {
      console.error('Failed to find bestsellers:', error);
      addLog(`❌ Lỗi tìm bestsellers: ${error}`);
    }
  };

  const startCrawlLinks = async (categoryId: number) => {
    // Reset server log tracking for new session
    setLastServerLogCount(0);
    addLog(`🚀 Bắt đầu crawl product links (trang ${settings.startPage}-${settings.endPage})`);

    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_links',
          categoryId,
          options: {
            startPage: settings.startPage,
            endPage: settings.endPage
          }
        })
      });

      const result = await response.json();
      if (result.success) {
        setIsCrawling(true);
        addLog('✅ Đã bắt đầu crawl product links');
      } else {
        addLog(`❌ Lỗi bắt đầu crawl: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to start link crawling:', error);
      addLog(`❌ Lỗi start crawl links: ${error}`);
    }
  };

  const startCrawlProducts = async (categoryId: number) => {
    // Reset server log tracking for new session
    setLastServerLogCount(0);
    addLog(`🔄 Bắt đầu crawl product details (${settings.threads} threads)`);

    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_products',
          categoryId,
          options: {
            threads: settings.threads,
            forceRecrawl: settings.forceRecrawl
          }
        })
      });

      const result = await response.json();
      if (result.success) {
        setIsCrawling(true);
        addLog('✅ Đã bắt đầu crawl product details');
      } else {
        addLog(`❌ Lỗi bắt đầu crawl: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to start product crawling:', error);
      addLog(`❌ Lỗi start crawl products: ${error}`);
    }
  };

  const stopCrawling = async () => {
    addLog('⏹️ Đang dừng crawling...');

    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });

      if (response.ok) {
        setIsCrawling(false);
        setCrawlProgress(null);
        addLog('✅ Đã dừng crawling');
      }
    } catch (error) {
      console.error('Failed to stop crawling:', error);
      addLog(`❌ Lỗi dừng crawling: ${error}`);
    }
  };

  const exportProducts = async (format: 'csv' | 'json') => {
    addLog(`📤 Đang export dữ liệu định dạng ${format.toUpperCase()}...`);

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          categoryId: selectedCategory,
          format
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `products.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        addLog(`✅ Export thành công: products.${format}`);
      }
    } catch (error) {
      console.error('Failed to export products:', error);
      addLog(`❌ Lỗi export: ${error}`);
    }
  };

  const exportProductLinks = async () => {
    addLog('📤 Đang export product links CSV...');

    try {
      const response = await fetch('/api/product-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          categoryId: linksFilter.categoryId
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'product-links.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        addLog(`✅ Export thành công: product-links.csv`);
      }
    } catch (error) {
      console.error('Failed to export product links:', error);
      addLog(`❌ Lỗi export product links: ${error}`);
    }
  };

  // Batch Operations
  const startBatchBestsellers = async () => {
    // Reset batch log tracking for new session
    setLastBatchLogCount(0);
    addLog(`🚀 Bắt đầu tìm bestseller hàng loạt (${settings.batchThreads} luồng)...`);

    try {
      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'find_bestsellers_batch',
          options: {
            threads: settings.batchThreads,
            forceRecrawl: settings.forceRecrawl
          }
        })
      });

      const result = await response.json();
      if (result.success) {
        setIsBatchRunning(true);
        addLog(`✅ ${result.message}`);
      } else {
        addLog(`❌ Lỗi batch bestsellers: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to start batch bestsellers:', error);
      addLog(`❌ Lỗi batch bestsellers: ${error}`);
    }
  };

  const startBatchLinks = async () => {
    // Reset batch log tracking for new session
    setLastBatchLogCount(0);
    addLog(`🚀 Bắt đầu crawl links hàng loạt (${settings.batchThreads} luồng, ${settings.batchPages} trang/category)...`);
    console.log('🚀 [FRONTEND] Starting batch links operation...');

    try {
      const requestBody = {
        action: 'crawl_links_batch',
        options: {
          threads: settings.batchThreads,
          startPage: 1,
          endPage: settings.batchPages
        }
      };

      console.log('📤 [FRONTEND] Sending request to /api/batch:', requestBody);

      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      console.log(`📥 [FRONTEND] API Response: ${response.status} ${response.statusText}`);

      const result = await response.json();
      console.log('📊 [FRONTEND] API Result:', result);

      if (result.success) {
        setIsBatchRunning(true);
        addLog(`✅ ${result.message}`);
        if (result.details) {
          addLog(`📊 Chi tiết: ${result.details.categoriesCount} categories, ${result.details.threads} threads, pages ${result.details.startPage}-${result.details.endPage}`);
        }
        console.log('✅ [FRONTEND] Batch operation started successfully');

        // Start polling progress more frequently for better visibility
        const progressInterval = setInterval(() => {
          console.log('🔄 [FRONTEND] Polling batch progress...');
          checkBatchStatus();
        }, 1000);

        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(progressInterval);
          console.log('⏰ [FRONTEND] Stopped intensive progress polling after 5 minutes');
        }, 5 * 60 * 1000);

      } else {
        addLog(`❌ Lỗi batch links: ${result.error}`);
        console.error('❌ [FRONTEND] Batch operation failed:', result.error);
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Failed to start batch links:', error);
      addLog(`❌ Lỗi batch links: ${error}`);
    }
  };

  const stopBatch = async () => {
    addLog('⏹️ Đang dừng batch operation...');

    try {
      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_batch' })
      });

      if (response.ok) {
        setIsBatchRunning(false);
        setBatchProgress(null);
        addLog('✅ Đã dừng batch operation');
      }
    } catch (error) {
      console.error('Failed to stop batch:', error);
      addLog(`❌ Lỗi dừng batch: ${error}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'ready': return 'bg-blue-500';
      case 'crawling_links':
      case 'crawling_products': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'ready': return <CheckCircle className="w-4 h-4" />;
      case 'crawling_links':
      case 'crawling_products': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Barnes & Noble Scraper</h1>
          <p className="text-muted-foreground">
            Thu thập dữ liệu sách bestseller từ Barnes & Noble
          </p>
          {process.env.NODE_ENV === 'production' && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                🚀 <strong>Production Mode:</strong> Bắt đầu bằng cách click "Test API Health" để kiểm tra kết nối.
                Database sẽ được tạo tự động khi bạn crawl categories lần đầu.
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isCrawling && (
            <Badge variant="destructive" className="animate-pulse">
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              Đang crawl...
            </Badge>
          )}
        </div>
      </div>

      {/* API Health Check */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            API Health Check
          </CardTitle>
          <CardDescription>
            Kiểm tra trạng thái API và kết nối database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={testHealthCheck}
              disabled={isTesting}
              variant="outline"
              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            >
              {isTesting ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Test API Health
            </Button>
          </div>

          {debugInfo && (
            <div className="p-3 bg-gray-100 rounded-lg text-sm font-mono">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Status:</strong> {debugInfo.status || debugInfo.details?.status || 'Error'}
                </div>
                <div>
                  <strong>Content Length:</strong> {debugInfo.contentLength || 'N/A'}
                </div>
                <div>
                  <strong>Blocked:</strong>
                  <Badge variant={debugInfo.isBlocked ? "destructive" : "default"} className="ml-2">
                    {debugInfo.isBlocked ? 'YES' : 'NO'}
                  </Badge>
                </div>
                <div>
                  <strong>Links Found:</strong> {debugInfo.sampleLinks?.length || 0}
                </div>
                <div>
                  <strong>Barnes & Noble:</strong>
                  <Badge variant={debugInfo.hasBarnesNobleContent ? "default" : "destructive"} className="ml-2">
                    {debugInfo.hasBarnesNobleContent ? 'YES' : 'NO'}
                  </Badge>
                </div>
                <div>
                  <strong>Has Navigation:</strong>
                  <Badge variant={debugInfo.hasNavigation ? "default" : "destructive"} className="ml-2">
                    {debugInfo.hasNavigation ? 'YES' : 'NO'}
                  </Badge>
                </div>
                <div>
                  <strong>Categories:</strong>
                  <Badge variant={debugInfo.hasCategories ? "default" : "destructive"} className="ml-2">
                    {debugInfo.hasCategories ? 'YES' : 'NO'}
                  </Badge>
                </div>
                <div>
                  <strong>Redirects:</strong> {debugInfo.redirects || 0}
                </div>
              </div>

              {debugInfo.userAgent && (
                <div className="mt-3 p-2 bg-blue-50 rounded text-xs">
                  <strong>User Agent:</strong> {debugInfo.userAgent}
                </div>
              )}

              {debugInfo.sampleLinks && debugInfo.sampleLinks.length > 0 && (
                <div className="mt-3">
                  <strong>Sample Links Found:</strong>
                  <div className="max-h-32 overflow-y-auto mt-1 space-y-1">
                    {debugInfo.sampleLinks.slice(0, 10).map((link: any, index: number) => (
                      <div key={index} className="text-xs p-1 bg-white rounded border">
                        <span className="text-blue-600">[{link.type}]</span> {link.text.substring(0, 50)}...
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {debugInfo.error && (
                <div className="mt-3 p-2 bg-red-50 rounded">
                  <strong className="text-red-600">Error Details:</strong>
                  <div className="text-xs mt-1">{debugInfo.error}</div>
                  {debugInfo.details && (
                    <div className="text-xs mt-1 text-gray-600">
                      Code: {debugInfo.details.code} |
                      Timeout: {debugInfo.details.timeout ? 'YES' : 'NO'} |
                      DNS Error: {debugInfo.details.dnsError ? 'YES' : 'NO'}
                    </div>
                  )}
                </div>
              )}

              {debugInfo.contentPreview && !debugInfo.error && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-bold">Content Preview</summary>
                  <div className="text-xs mt-2 p-2 bg-white rounded border max-h-32 overflow-y-auto">
                    {debugInfo.contentPreview}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Display */}
      {crawlProgress && (
        <Card>
          <CardHeader>
            <CardTitle>Tiến trình Crawling</CardTitle>
            <CardDescription>
              Trạng thái: {crawlProgress.status}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {crawlProgress.status === 'crawling_links' && (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Trang {crawlProgress.currentPage}/{crawlProgress.totalPages}</span>
                  <span>{Math.round((crawlProgress.currentPage / crawlProgress.totalPages) * 100)}%</span>
                </div>
                <Progress value={(crawlProgress.currentPage / crawlProgress.totalPages) * 100} />
              </div>
            )}

            {crawlProgress.status === 'crawling_products' && (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Sản phẩm {crawlProgress.currentProduct}/{crawlProgress.totalProducts}</span>
                  <span>{Math.round((crawlProgress.currentProduct / crawlProgress.totalProducts) * 100)}%</span>
                </div>
                <Progress value={(crawlProgress.currentProduct / crawlProgress.totalProducts) * 100} />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Thành công: {crawlProgress.successfulProducts}</span>
                  <span>Thất bại: {crawlProgress.failedProducts}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={stopCrawling}
                disabled={!isCrawling}
              >
                <StopCircle className="w-4 h-4 mr-2" />
                Dừng
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch Progress Display */}
      {batchProgress && isBatchRunning && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              Batch Operation Progress
            </CardTitle>
            <CardDescription>
              Đang xử lý: {batchProgress.current || 'Đang khởi tạo...'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Categories: {batchProgress.completed + batchProgress.failed}/{batchProgress.total}</span>
                <span>{Math.round(((batchProgress.completed + batchProgress.failed) / batchProgress.total) * 100)}%</span>
              </div>
              <Progress value={((batchProgress.completed + batchProgress.failed) / batchProgress.total) * 100} />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span className="text-green-600">✅ Thành công: {batchProgress.completed}</span>
                <span className="text-red-600">❌ Thất bại: {batchProgress.failed}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={stopBatch}
                disabled={!isBatchRunning}
              >
                <StopCircle className="w-4 h-4 mr-2" />
                Dừng Batch
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Nhật ký hoạt động</CardTitle>
          <CardDescription>Real-time logs và tiến trình</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-black text-green-400 p-4 rounded-lg h-40 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500">Chưa có hoạt động nào...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogs([])}
            >
              Xóa logs
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">Danh mục</TabsTrigger>
          <TabsTrigger value="links">Product Links</TabsTrigger>
          <TabsTrigger value="products">Sản phẩm</TabsTrigger>
          <TabsTrigger value="settings">Cài đặt</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Quản lý Danh mục ({categories.length})
                {categories.length === 0 && (
                  <span className="text-xs text-yellow-600 ml-2">
                    [Debug: Categories empty - Last log: {logs[logs.length - 1] || 'No logs'}]
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Crawl và quản lý các danh mục sách từ Barnes & Noble
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Regular Operations */}
                <div className="flex gap-2">
                  <Button
                    onClick={crawlCategories}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Crawl Danh mục
                  </Button>
                  <Button
                    variant="outline"
                    onClick={loadCategories}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh ({categories.length})
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      addLog('🔍 Force testing API call...');
                      try {
                        const response = await fetch('/api/categories');
                        addLog(`📡 API Status: ${response.status}`);
                        const data = await response.json();
                        addLog(`📊 API Success: ${data.success}, Count: ${data.data?.length || 0}`);
                        if (data.success && data.data?.length > 0) {
                          addLog(`✅ Setting categories state with ${data.data.length} items`);
                          setCategories(data.data);
                        } else {
                          addLog(`❌ API returned: ${JSON.stringify(data)}`);
                        }
                      } catch (error) {
                        addLog(`❌ Fetch error: ${error}`);
                      }
                    }}
                  >
                    🔧 Force Test
                  </Button>
                </div>

                {/* Batch Operations */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3 text-blue-700">🚀 Batch Operations (Đa luồng + Proxy)</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="batchThreads" className="text-xs">Luồng:</Label>
                      <Input
                        id="batchThreads"
                        type="number"
                        value={settings.batchThreads}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          batchThreads: parseInt(e.target.value) || 20
                        }))}
                        min="1"
                        max="50"
                        className="w-16 h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="batchPages" className="text-xs">Trang/Category:</Label>
                      <Input
                        id="batchPages"
                        type="number"
                        value={settings.batchPages}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          batchPages: parseInt(e.target.value) || 5
                        }))}
                        min="1"
                        max="20"
                        className="w-16 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={startBatchBestsellers}
                      disabled={isBatchRunning || isLoading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isBatchRunning ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <TrendingUp className="w-4 h-4 mr-2" />
                      )}
                      🔍 Batch Bestsellers ({settings.batchThreads} luồng)
                    </Button>
                    <Button
                      onClick={startBatchLinks}
                      disabled={isBatchRunning || isLoading}
                      variant="outline"
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      {isBatchRunning ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4 mr-2" />
                      )}
                      🔗 Batch Links ({settings.batchPages} trang)
                    </Button>
                  </div>

                  <div className="text-xs text-gray-600 mt-2">
                    💡 Batch operations sử dụng proxy và đa luồng để xử lý nhanh hơn
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(category.status)}
                        <h3 className="font-medium">{category.name}</h3>
                        <Badge
                          className={getStatusColor(category.status)}
                          variant="secondary"
                        >
                          {category.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {category.url}
                      </p>
                      {category.bestseller_url && (
                        <p className="text-xs text-blue-600 truncate">
                          Bestseller: {category.bestseller_url}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {!category.bestseller_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => findBestsellers(category.id, category.url)}
                        >
                          Tìm Bestseller
                        </Button>
                      )}

                      {category.bestseller_url && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => startCrawlLinks(category.id)}
                            disabled={isCrawling}
                          >
                            <PlayCircle className="w-4 h-4 mr-1" />
                            Crawl Links
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startCrawlProducts(category.id)}
                            disabled={isCrawling}
                          >
                            <Database className="w-4 h-4 mr-1" />
                            Crawl Products
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Product Links ({productLinks.length})
                {linksStats && (
                  <div className="flex gap-2 ml-4">
                    <Badge variant="default">Tổng: {linksStats.total}</Badge>
                    <Badge variant="default" className="bg-green-600">Đã crawl: {linksStats.crawled}</Badge>
                    <Badge variant="destructive">Chưa crawl: {linksStats.uncrawled}</Badge>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                Danh sách các product links đã crawl từ bestseller pages, phân theo category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="categoryFilter">Category</Label>
                    <select
                      id="categoryFilter"
                      value={linksFilter.categoryId}
                      onChange={(e) => setLinksFilter(prev => ({
                        ...prev,
                        categoryId: e.target.value,
                        page: 1
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="all">Tất cả categories</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="crawledFilter">Trạng thái</Label>
                    <select
                      id="crawledFilter"
                      value={linksFilter.crawled}
                      onChange={(e) => setLinksFilter(prev => ({
                        ...prev,
                        crawled: e.target.value,
                        page: 1
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="all">Tất cả</option>
                      <option value="true">Đã crawl</option>
                      <option value="false">Chưa crawl</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end">
                    <Button onClick={loadProductLinks}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Tải
                    </Button>
                  </div>
                  <div className="flex flex-col justify-end">
                    <Button
                      variant="outline"
                      onClick={exportProductLinks}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>

                {/* Stats by Category */}
                {linksStats && Object.keys(linksStats.byCategory).length > 0 && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h4 className="font-medium mb-3">📊 Thống kê theo Category</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(linksStats.byCategory).map(([categoryId, stats]: [string, any]) => (
                        <div key={categoryId} className="p-3 bg-white rounded border">
                          <div className="font-medium text-sm truncate">{stats.category_name}</div>
                          <div className="flex gap-3 text-xs text-gray-600 mt-1">
                            <span>📋 {stats.total}</span>
                            <span className="text-green-600">✅ {stats.crawled}</span>
                            <span className="text-red-600">❌ {stats.uncrawled}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{
                                width: `${stats.total > 0 ? (stats.crawled / stats.total) * 100 : 0}%`
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {productLinks.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Chưa có product links nào</p>
                      <p className="text-sm">Hãy crawl categories và tìm bestsellers trước</p>
                    </div>
                  ) : (
                    productLinks.map((link) => (
                      <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={link.crawled ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {link.crawled ? "✅ Crawled" : "❌ Pending"}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              {link.category_name || `Category ${link.category_id}`}
                            </span>
                            <span className="text-xs text-gray-500">
                              Page {link.page_number} • #{link.rank_in_page}
                            </span>
                          </div>
                          <p className="text-sm text-blue-600 truncate mt-1" title={link.url}>
                            {link.url}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(link.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(link.url, '_blank')}
                          >
                            🔗 Open
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Danh sách Sản phẩm ({products.length})
              </CardTitle>
              <CardDescription>
                Tìm kiếm và xuất dữ liệu sản phẩm
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Tìm kiếm theo tên sách hoặc ISBN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && loadProducts(undefined, searchTerm)}
                  />
                </div>
                <Button onClick={() => loadProducts(undefined, searchTerm)}>
                  <Search className="w-4 h-4 mr-2" />
                  Tìm kiếm
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportProducts('csv')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportProducts('json')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  JSON
                </Button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {products.map((product) => (
                  <div key={product.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium line-clamp-2">{product.title}</h3>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          {product.isbn && <span>ISBN: {product.isbn}</span>}
                          {product.price && <span>Giá: ${product.price}</span>}
                          <span>Trang: {product.page_number}</span>
                          <span>Thứ hạng: {product.rank_in_page}</span>
                        </div>
                        {product.category_name && (
                          <Badge variant="outline" className="mt-2">
                            {product.category_name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={product.in_stock ? "default" : "destructive"}
                        >
                          {product.in_stock ? "Còn hàng" : "Hết hàng"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Cài đặt Crawling
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Individual Crawling Settings */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-gray-700">🔧 Individual Crawling</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="threads">Số luồng đồng thời</Label>
                    <Input
                      id="threads"
                      type="number"
                      value={settings.threads}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        threads: parseInt(e.target.value) || 10
                      }))}
                      min="1"
                      max="50"
                    />
                  </div>

                  <div>
                    <Label htmlFor="startPage">Trang bắt đầu</Label>
                    <Input
                      id="startPage"
                      type="number"
                      value={settings.startPage}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        startPage: parseInt(e.target.value) || 1
                      }))}
                      min="1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="endPage">Trang kết thúc</Label>
                    <Input
                      id="endPage"
                      type="number"
                      value={settings.endPage}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        endPage: parseInt(e.target.value) || 50
                      }))}
                      min="1"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Batch Processing Settings */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border">
                <h4 className="text-sm font-semibold mb-3 text-blue-700 flex items-center gap-2">
                  🚀 Batch Processing (Đa luồng + Proxy)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="batchThreads">Số luồng batch</Label>
                    <Input
                      id="batchThreads"
                      type="number"
                      value={settings.batchThreads}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        batchThreads: parseInt(e.target.value) || 20
                      }))}
                      min="5"
                      max="100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Khuyến nghị: 20-50 luồng</p>
                  </div>

                  <div>
                    <Label htmlFor="batchPages">Trang/Category (Batch)</Label>
                    <Input
                      id="batchPages"
                      type="number"
                      value={settings.batchPages}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        batchPages: parseInt(e.target.value) || 5
                      }))}
                      min="1"
                      max="50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Để batch nhanh, dùng 5-10 trang</p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-100 rounded-md">
                  <p className="text-xs text-blue-800">
                    <strong>💡 Batch Mode:</strong> Xử lý nhiều categories cùng lúc với proxy rotation và retry logic.
                    Nhanh gấp 10-20 lần so với individual crawling.
                  </p>
                </div>
              </div>

              {/* General Settings */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-gray-700">⚙️ General Options</h4>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="forceRecrawl"
                    checked={settings.forceRecrawl}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      forceRecrawl: e.target.checked
                    }))}
                  />
                  <Label htmlFor="forceRecrawl">
                    Crawl lại dữ liệu đã tồn tại (Force recrawl)
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
