import { NextRequest, NextResponse } from 'next/server';
import { isBuildMode, createBuildModeResponse, logBuildMode } from '@/lib/build-utils';

// Force this API route to be dynamic (not statically generated)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Global batch processor instance
let batchProcessor: BatchProcessor | null = null;

export async function GET() {
  try {
    // Early build mode check - before any imports
    if (isBuildMode()) {
      logBuildMode('batch-get');
      return NextResponse.json({
        success: true,
        data: {
          isRunning: false,
          progress: null,
          logs: []
        },
        buildMode: true
      });
    }

    // Lazy import heavy dependencies only in runtime
    const {
      BatchProcessor,
      getCrawlProgress,
      stopCrawling,
      resetBatchStats,
      getBatchLogs
    } = await import('@/lib/batch-processor');

    const progress = getCrawlProgress();
    const isRunning = batchProcessor?.isRunning || false;
    const logs = getBatchLogs();

    return NextResponse.json({
      success: true,
      data: {
        isRunning,
        progress,
        // expose detailed logs for frontend
        logs
      }
    });
  } catch (error: any) {
    console.error('Failed to get batch status:', error);

    // Fallback to build mode response on error
    if (isBuildMode()) {
      logBuildMode('batch-get-error');
      return NextResponse.json({
        success: true,
        data: {
          isRunning: false,
          progress: null,
          logs: []
        },
        buildMode: true,
        error: 'Batch status error in build mode'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to get batch status'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Early build mode check - before any imports
    if (isBuildMode()) {
      logBuildMode('batch-post');
      return NextResponse.json(createBuildModeResponse('Batch operations not available during build'));
    }

    // Lazy import heavy dependencies only in runtime
    const {
      BatchProcessor,
      getCrawlProgress,
      stopCrawling,
      resetBatchStats,
      getBatchLogs
    } = await import('@/lib/batch-processor');
    const { getCategories } = await import('@/lib/database-supabase');

    const body = await request.json();
    const { action, options = {} } = body;

    console.log(`📦 Batch API: ${action}`, options);

    switch (action) {
      case 'find_bestsellers_batch': {
        if (batchProcessor?.isRunning) {
          return NextResponse.json({
            success: false,
            error: 'Batch operation is already running'
          }, { status: 400 });
        }

        // Get categories that need bestseller URLs
        const categories = await getCategories();
        const categoriesNeedingBestsellers = categories.filter(cat => !cat.bestseller_url);

        if (categoriesNeedingBestsellers.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'All categories already have bestseller URLs'
          }, { status: 400 });
        }

        batchProcessor = new BatchProcessor();

        // Start batch bestseller finding in background
        setImmediate(() => {
          batchProcessor?.startBatchBestsellers(categoriesNeedingBestsellers, {
            threads: options.threads || 20,
            forceRecrawl: options.forceRecrawl || false
          });
        });

        return NextResponse.json({
          success: true,
          message: `Started batch bestseller finding for ${categoriesNeedingBestsellers.length} categories`
        });
      }

      case 'crawl_links_batch': {
        console.log('🚀 [BATCH API] Received crawl_links_batch request with options:', options);

        if (batchProcessor?.isRunning) {
          console.log('⚠️ [BATCH API] Batch processor already running, rejecting request');
          return NextResponse.json({
            success: false,
            error: 'Batch operation is already running'
          }, { status: 400 });
        }

        console.log('📋 [BATCH API] Loading categories from database...');
        const categories = await getCategories();
        console.log(`📊 [BATCH API] Found ${categories.length} total categories`);

        const categoriesWithBestsellers = categories.filter(cat => cat.bestseller_url);
        console.log(`✅ [BATCH API] ${categoriesWithBestsellers.length} categories have bestseller URLs`);
        console.log('📝 [BATCH API] Categories ready for batch processing:', categoriesWithBestsellers.map(c => c.name));

        if (categoriesWithBestsellers.length === 0) {
          console.log('❌ [BATCH API] No categories with bestseller URLs found');
          return NextResponse.json({
            success: false,
            error: 'No categories have bestseller URLs. Find bestsellers first.'
          }, { status: 400 });
        }

        console.log('🔧 [BATCH API] Creating new BatchProcessor...');
        batchProcessor = new BatchProcessor();

        const batchOptions = {
          threads: options.threads || 20,
          startPage: options.startPage || 1,
          endPage: options.endPage || 5
        };
        console.log('⚙️ [BATCH API] Batch options:', batchOptions);

        // Start batch links crawling in background
        console.log('🚀 [BATCH API] Starting batch processor in background...');
        setImmediate(() => {
          console.log('🎯 [BATCH API] Batch processor starting now...');
          batchProcessor?.startBatchLinks(categoriesWithBestsellers, batchOptions);
        });

        const responseMessage = `Started batch links crawling for ${categoriesWithBestsellers.length} categories with ${batchOptions.threads} threads (pages ${batchOptions.startPage}-${batchOptions.endPage})`;
        console.log(`✅ [BATCH API] ${responseMessage}`);

        return NextResponse.json({
          success: true,
          message: responseMessage,
          details: {
            categoriesCount: categoriesWithBestsellers.length,
            ...batchOptions
          }
        });
      }

      case 'stop_batch': {
        if (batchProcessor?.isRunning) {
          await stopCrawling();
          batchProcessor = null;
          resetBatchStats();
        }

        return NextResponse.json({
          success: true,
          message: 'Batch operation stopped'
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Batch API error:', error);

    // Fallback to build mode response on error
    if (isBuildMode()) {
      logBuildMode('batch-post-error');
      return NextResponse.json(createBuildModeResponse('Batch operation error in build mode'));
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
