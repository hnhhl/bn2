import { NextRequest, NextResponse } from 'next/server';
import { isBuildMode, createBuildModeResponse, logBuildMode } from '@/lib/build-utils';

// Force this API route to be dynamic (not statically generated)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Early build mode check - before any imports
    if (isBuildMode()) {
      logBuildMode('products');
      return NextResponse.json(createBuildModeResponse('Products not available during build'));
    }

    // Lazy import heavy dependencies only in runtime
    const { getProducts, getCategories } = await import('@/lib/database-supabase');

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');

    console.log(`📋 Getting products - Category: ${categoryId}, Search: ${search}, Page: ${page}`);

    // Build filters
    const filters: any = {};
    if (categoryId) {
      filters.category_id = parseInt(categoryId);
    }
    if (search) {
      filters.search = search;
    }

    // Get products
    const products = await getProducts(filters, { page, limit });

    console.log(`✅ Found ${products.length} products`);

    return NextResponse.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total: products.length
        }
      }
    });
  } catch (error: any) {
    console.error('Failed to get products:', error);

    // Fallback to build mode response on error
    if (isBuildMode()) {
      logBuildMode('products-error');
      return NextResponse.json(createBuildModeResponse('Products error in build mode'));
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to get products'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Early build mode check - before any imports
    if (isBuildMode()) {
      logBuildMode('products-post');
      return NextResponse.json(createBuildModeResponse('Export not available during build'));
    }

    // Lazy import heavy dependencies only in runtime
    const { getProducts, getCategories } = await import('@/lib/database-supabase');

    const body = await request.json();
    const { action, categoryId, format } = body;

    if (action === 'export') {
      console.log(`📤 Exporting products for category: ${categoryId} in format: ${format}`);

      // Build filters
      const filters: any = {};
      if (categoryId) {
        filters.category_id = parseInt(categoryId);
      }

      const products = await getProducts(filters, { page: 1, limit: 10000 });
      const categories = await getCategories();
      const categoryMap = new Map(categories.map(cat => [cat.id, cat.name]));

      if (format === 'csv') {
        // Generate CSV
        const headers = ['ID', 'Title', 'ISBN', 'Price', 'Original Price', 'Category', 'Page', 'Rank', 'In Stock', 'URL', 'Last Updated'];
        const rows = products.map(product => [
          product.id,
          product.title,
          product.isbn || '',
          product.price || '',
          product.original_price || '',
          categoryMap.get(product.category_id) || `Category ${product.category_id}`,
          product.page_number,
          product.rank_in_page,
          product.in_stock ? 'Yes' : 'No',
          product.product_url,
          product.last_updated || product.created_at
        ]);

        const csv = [headers, ...rows]
          .map(row => row.map(cell => `"${cell}"`).join(','))
          .join('\n');

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="products.csv"'
          }
        });
      } else if (format === 'json') {
        return new NextResponse(JSON.stringify(products, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="products.json"'
          }
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: `Unknown action: ${action}`
    }, { status: 400 });
  } catch (error: any) {
    console.error('Products API error:', error);

    // Fallback to build mode response on error
    if (isBuildMode()) {
      logBuildMode('products-post-error');
      return NextResponse.json(createBuildModeResponse('Export error in build mode'));
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
