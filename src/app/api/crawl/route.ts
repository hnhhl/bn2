import { NextRequest, NextResponse } from 'next/server';
import { isBuildMode, createBuildModeResponse, logBuildMode } from '@/lib/build-utils';

// Force this API route to be dynamic (not statically generated)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Simple in-memory log buffer for crawl session
const LOG_BUFFER_SIZE = 500;
let logBuffer: string[] = [];
function pushLog(message: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${message}`;
  logBuffer.push(line);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer = logBuffer.slice(-LOG_BUFFER_SIZE);
  }
  // Also mirror to server console for debugging
  console.log(line);
}

// Global crawl state
let crawlState = {
  isRunning: false,
  progress: null as any
};

export async function GET() {
  try {
    // Early build mode check - before any imports
    if (isBuildMode()) {
      logBuildMode('crawl-get');
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
    const { ProxyManager } = await import('@/lib/proxy-manager');
    const { BarnesNobleScraper } = await import('@/lib/scraper');
    const {
      getCategoryById,
      getProductLinks,
      createProduct,
      createProductLink,
      updateProductLink,
      updateCategoryStatus
    } = await import('@/lib/database-supabase');

    return NextResponse.json({
      success: true,
      data: {
        isRunning: crawlState.isRunning,
        progress: crawlState.progress,
        // expose last ~200 lines to client for UI logs
        logs: logBuffer.slice(-200)
      }
    });
  } catch (error: any) {
    console.error('Failed to get crawl status:', error);

    // Fallback to build mode response on error
    if (isBuildMode()) {
      logBuildMode('crawl-get-error');
      return NextResponse.json({
        success: true,
        data: {
          isRunning: false,
          progress: null,
          logs: []
        },
        buildMode: true,
        error: 'Crawl status error in build mode'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to get crawl status'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Early build mode check - before any imports
    if (isBuildMode()) {
      logBuildMode('crawl-post');
      return NextResponse.json(createBuildModeResponse('Crawl operations not available during build'));
    }

    // Lazy import heavy dependencies only in runtime
    const { ProxyManager } = await import('@/lib/proxy-manager');
    const { BarnesNobleScraper } = await import('@/lib/scraper');
    const {
      getCategoryById,
      getProductLinks,
      createProduct,
      createProductLink,
      updateProductLink,
      updateCategoryStatus
    } = await import('@/lib/database-supabase');

    const body = await request.json();
    const { action, categoryId, options = {} } = body;

    pushLog(`🚀 Crawl API: ${action} ${categoryId ? `(categoryId=${categoryId})` : ''} ${Object.keys(options).length ? JSON.stringify(options) : ''}`);

    switch (action) {
      case 'start_links': {
        if (crawlState.isRunning) {
          return NextResponse.json({
            success: false,
            error: 'Crawl is already running'
          }, { status: 400 });
        }

        const category = await getCategoryById(categoryId);
        if (!category || !category.bestseller_url) {
          pushLog('❌ Category not found or missing bestseller URL');
          return NextResponse.json({
            success: false,
            error: 'Category not found or no bestseller URL'
          }, { status: 400 });
        }

        // reset buffer for a new session
        logBuffer = [];
        pushLog(`🎯 Start crawling product links for "${category.name}" from ${options.startPage || 1} to ${options.endPage || 50}`);

        // Start crawling in background
        startLinksCrawl(category, options);

        return NextResponse.json({
          success: true,
          message: 'Started crawling product links'
        });
      }

      case 'start_products': {
        if (crawlState.isRunning) {
          return NextResponse.json({
            success: false,
            error: 'Crawl is already running'
          }, { status: 400 });
        }

        const category = await getCategoryById(categoryId);
        if (!category) {
          pushLog('❌ Category not found');
          return NextResponse.json({
            success: false,
            error: 'Category not found'
          }, { status: 400 });
        }

        // reset buffer for a new session
        logBuffer = [];
        pushLog(`🛍️ Start crawling products for "${category.name}" with ${options.threads || 10} threads`);

        // Start product crawling in background
        startProductsCrawl(category, options);

        return NextResponse.json({
          success: true,
          message: 'Started crawling products'
        });
      }

      case 'stop': {
        crawlState.isRunning = false;
        crawlState.progress = null;
        pushLog('⏹️ Crawl stopped by user');

        return NextResponse.json({
          success: true,
          message: 'Crawl stopped'
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Crawl API error:', error);
    pushLog(`❌ Crawl API error: ${error?.message || error}`);

    // Fallback to build mode response on error
    if (isBuildMode()) {
      logBuildMode('crawl-post-error');
      return NextResponse.json(createBuildModeResponse('Crawl operation error in build mode'));
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV !== 'production' ? String(error) : undefined
    }, { status: 500 });
  }
}

async function startLinksCrawl(category: any, options: any) {
  crawlState.isRunning = true;
  const { startPage = 1, endPage = 50 } = options;

  crawlState.progress = {
    category: category.name,
    status: 'crawling_links',
    currentPage: 0,
    totalPages: endPage - startPage + 1,
    // counters
    pagesSucceeded: 0,
    pagesFailed: 0,
    linksFound: 0,
    linksSaved: 0,
    linksDuplicate: 0
  };

  try {
    await updateCategoryStatus(category.id, 'crawling_links');

    const proxyManager = new ProxyManager();
    const scraper = new BarnesNobleScraper(proxyManager);

    for (let page = startPage; page <= endPage; page++) {
      if (!crawlState.isRunning) break;

      crawlState.progress.currentPage = page - startPage + 1;

      try {
        const pageUrl = `${category.bestseller_url}?Nrpp=20&page=${page}`;
        pushLog(`📄 Fetching page ${page}/${endPage} -> ${pageUrl}`);

        const links = await scraper.extractProductLinks(pageUrl);
        crawlState.progress.linksFound += links.length;

        // Save links to database
        for (let i = 0; i < links.length; i++) {
          const link = links[i];
          try {
            await createProductLink({
              url: link.url,
              category_id: category.id,
              page_number: page,
              rank_in_page: i + 1
            });
            crawlState.progress.linksSaved++;
            if ((i + 1) % 10 === 0) pushLog(`✅ Saved ${i + 1}/${links.length} links on page ${page}`);
          } catch (error) {
            // Link might already exist, continue
            crawlState.progress.linksDuplicate++;
            if ((i + 1) % 25 === 0) pushLog(`ℹ️ Duplicate so far on page ${page}: ${crawlState.progress.linksDuplicate}`);
          }
        }

        pushLog(`✅ Page ${page}: Found ${links.length} links | Saved: ${crawlState.progress.linksSaved}, Duplicates: ${crawlState.progress.linksDuplicate}`);
        crawlState.progress.pagesSucceeded++;

        // Small delay between pages
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (pageError: any) {
        pushLog(`❌ Error crawling page ${page}: ${pageError?.message || pageError}`);
        crawlState.progress.pagesFailed++;
        // Continue with next page
      }
    }

    await updateCategoryStatus(category.id, 'completed');
    pushLog(`🏁 Completed crawling links for ${category.name}. Pages ok=${crawlState.progress.pagesSucceeded}, failed=${crawlState.progress.pagesFailed}. Saved=${crawlState.progress.linksSaved} (duplicates=${crawlState.progress.linksDuplicate}).`);
  } catch (error: any) {
    pushLog(`❌ Fatal error while crawling links for ${category.name}: ${error?.message || error}`);
    await updateCategoryStatus(category.id, 'error');
  } finally {
    crawlState.isRunning = false;
    // keep final progress snapshot for one last poll
    setTimeout(() => { crawlState.progress = null; }, 10_000);
  }
}

async function startProductsCrawl(category: any, options: any) {
  crawlState.isRunning = true;
  const { threads = 10, forceRecrawl = false } = options;

  try {
    await updateCategoryStatus(category.id, 'crawling_products');

    // Get uncrawled product links
    const filters = {
      category_id: category.id,
      crawled: false
    };

    const productLinks = await getProductLinks(filters, { page: 1, limit: 10000 });

    crawlState.progress = {
      category: category.name,
      status: 'crawling_products',
      currentProduct: 0,
      totalProducts: productLinks.length,
      successfulProducts: 0,
      failedProducts: 0
    };

    pushLog(`🛍️ Starting to crawl ${productLinks.length} products for ${category.name} with ${threads} threads`);

    const proxyManager = new ProxyManager();
    const scraper = new BarnesNobleScraper(proxyManager);

    // Process links with limited concurrency
    const batchSize = threads;
    for (let i = 0; i < productLinks.length; i += batchSize) {
      if (!crawlState.isRunning) break;

      const batch = productLinks.slice(i, i + batchSize);
      const promises = batch.map(async (link) => {
        try {
          const productData = await scraper.extractProductData(link.url);

          if (productData) {
            await createProduct({
              ...productData,
              category_id: category.id,
              page_number: link.page_number,
              rank_in_page: link.rank_in_page,
              product_url: link.url
            });

            await updateProductLink(link.id, { crawled: true });
            crawlState.progress.successfulProducts++;
            if (crawlState.progress.currentProduct % 25 === 0) pushLog(`✅ Saved ${crawlState.progress.successfulProducts} products so far`);
          } else {
            crawlState.progress.failedProducts++;
            pushLog(`⚠️ Empty product data for ${link.url}`);
          }
        } catch (error: any) {
          pushLog(`❌ Error crawling product ${link.url}: ${error?.message || error}`);
          crawlState.progress.failedProducts++;
        }

        crawlState.progress.currentProduct++;
      });

      await Promise.all(promises);

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    await updateCategoryStatus(category.id, 'completed');
    pushLog(`🏁 Completed crawling products for ${category.name}: ${crawlState.progress.successfulProducts} ok, ${crawlState.progress.failedProducts} failed`);
  } catch (error: any) {
    pushLog(`❌ Error crawling products for ${category.name}: ${error?.message || error}`);
    await updateCategoryStatus(category.id, 'error');
  } finally {
    crawlState.isRunning = false;
    setTimeout(() => { crawlState.progress = null; }, 10_000);
  }
}
