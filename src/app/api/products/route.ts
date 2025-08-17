import { NextRequest, NextResponse } from 'next/server';
import {
  getProducts,
  getCategories
} from '@/lib/database-supabase';

export async function GET(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error('Failed to get products:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get products'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, categoryId, format } = body;

    if (action === 'export') {
      console.log(`📤 Exporting products in ${format} format for category: ${categoryId}`);

      // Get all products for the category
      const filters: any = {};
      if (categoryId) {
        filters.category_id = parseInt(categoryId);
      }

      const products = await getProducts(filters, { page: 1, limit: 10000 });
      const categories = await getCategories();
      const categoryMap = new Map(categories.map(cat => [cat.id, cat.name]));

      if (format === 'csv') {
        // Generate CSV
        const headers = [
          'ID', 'Title', 'ISBN', 'Price', 'Original Price',
          'Category', 'Page', 'Rank', 'In Stock', 'URL', 'Last Updated'
        ];
        const rows = products.map(product => [
          product.id,
          product.title,
          product.isbn || '',
          product.price || '',
          product.original_price || '',
          product.category_name || categoryMap.get(product.category_id) || '',
          product.page_number,
          product.rank_in_page,
          product.in_stock ? 'Yes' : 'No',
          product.product_url,
          new Date(product.last_updated).toISOString()
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
        // Generate JSON
        const jsonData = {
          exported_at: new Date().toISOString(),
          total_products: products.length,
          filters: { categoryId },
          products: products
        };

        return new NextResponse(JSON.stringify(jsonData, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="products.json"'
          }
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: `Unknown action: ${action} or format: ${format}`
    }, { status: 400 });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
