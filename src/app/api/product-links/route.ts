import { NextRequest, NextResponse } from 'next/server';
import { isBuildMode, createBuildModeResponse, logBuildMode } from '@/lib/build-utils';

// Force this API route to be dynamic (not statically generated)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Early build mode check - before any imports
    if (isBuildMode()) {
      logBuildMode('product-links');
      return NextResponse.json({
        success: true,
        data: {
          links: [],
          stats: { total: 0, crawled: 0, uncrawled: 0, byCategory: {} },
          pagination: { page: 1, limit: 100, total: 0 }
        },
        buildMode: true
      });
    }

    // Lazy import heavy dependencies only in runtime
    const {
      getProductLinks,
      getProductLinksStats,
      getCategories
    } = await import('@/lib/database-supabase');

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const crawled = searchParams.get('crawled');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');

    console.log(`📋 Getting product links - Category: ${categoryId}, Crawled: ${crawled}, Page: ${page}`);

    // Build filters
    const filters: any = {};
    if (categoryId && categoryId !== 'all') {
      filters.category_id = parseInt(categoryId);
    }
    if (crawled && crawled !== 'all') {
      filters.crawled = crawled === 'true';
    }

    // Get links and stats
    const [links, stats] = await Promise.all([
      getProductLinks(filters, { page, limit }),
      getProductLinksStats(filters.category_id)
    ]);

    console.log(`✅ Found ${links.length} product links`);

    return NextResponse.json({
      success: true,
      data: {
        links,
        stats,
        pagination: {
          page,
          limit,
          total: stats.total
        }
      }
    });
  } catch (error: any) {
    console.error('Failed to get product links:', error);

    // Fallback to build mode response on error
    if (isBuildMode()) {
      logBuildMode('product-links-error');
      return NextResponse.json({
        success: true,
        data: {
          links: [],
          stats: { total: 0, crawled: 0, uncrawled: 0, byCategory: {} },
          pagination: { page: 1, limit: 100, total: 0 }
        },
        buildMode: true,
        error: 'Product links error in build mode'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to get product links'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Early build mode check - before any imports
    if (isBuildMode()) {
      logBuildMode('product-links-post');
      return NextResponse.json(createBuildModeResponse('Export not available during build'));
    }

    // Lazy import heavy dependencies only in runtime
    const {
      getProductLinks,
      getProductLinksStats,
      getCategories
    } = await import('@/lib/database-supabase');

    const body = await request.json();
    const { action, categoryId } = body;

    if (action === 'export') {
      console.log(`📤 Exporting product links for category: ${categoryId}`);

      // Get all links for the category
      const filters: any = {};
      if (categoryId && categoryId !== 'all') {
        filters.category_id = parseInt(categoryId);
      }

      const links = await getProductLinks(filters, { page: 1, limit: 10000 });
      const categories = await getCategories();
      const categoryMap = new Map(categories.map(cat => [cat.id, cat.name]));

      // Generate CSV
      const headers = ['ID', 'URL', 'Category', 'Page', 'Rank', 'Crawled', 'Created At'];
      const rows = links.map(link => [
        link.id,
        link.url,
        categoryMap.get(link.category_id) || `Category ${link.category_id}`,
        link.page_number,
        link.rank_in_page,
        link.crawled ? 'Yes' : 'No',
        new Date(link.created_at).toISOString()
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="product-links.csv"'
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: `Unknown action: ${action}`
    }, { status: 400 });
  } catch (error: any) {
    console.error('Product links API error:', error);

    // Fallback to build mode response on error
    if (isBuildMode()) {
      logBuildMode('product-links-post-error');
      return NextResponse.json(createBuildModeResponse('Export error in build mode'));
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
