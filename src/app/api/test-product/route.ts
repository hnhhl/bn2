import { NextResponse } from 'next/server';
import { BarnesNobleScraper } from '@/lib/scraper';
import { ProxyManager } from '@/lib/proxy-manager';
import { isBuildMode, logBuildMode } from '@/lib/build-utils';

export async function GET() {
  try {
    // Check for build mode
    if (isBuildMode()) {
      logBuildMode('test-product');
      return NextResponse.json({
        success: true,
        data: {
          title: 'Sample Book Title (Build Mode)',
          isbn: '9781234567890',
          price: 19.99,
          original_price: 24.99,
          in_stock: true,
          product_url: 'https://example.com/sample-book',
          book_format: 'Hardcover',
          author: 'Sample Author',
          description: 'Sample book description for build mode testing',
          rating: '4.5 out of 5 stars'
        },
        buildMode: true,
        message: 'Sample product data in build mode'
      });
    }

    console.log('🛍️ Testing product data extraction...');

    const proxyManager = new ProxyManager();
    const scraper = new BarnesNobleScraper(proxyManager);

    // Test with a popular book URL (this should be relatively stable)
    const testProductUrl = 'https://www.barnesandnoble.com/w/the-seven-husbands-of-evelyn-hugo-taylor-jenkins-reid/1126295839';

    const startTime = Date.now();
    const productData = await scraper.extractProductData(testProductUrl);
    const endTime = Date.now();

    if (!productData) {
      return NextResponse.json({
        success: false,
        error: 'Failed to extract product data',
        details: 'Product data extraction returned null'
      }, { status: 500 });
    }

    console.log(`✅ Product extraction completed in ${endTime - startTime}ms:`, {
      title: productData.title?.substring(0, 50) + '...',
      isbn: productData.isbn,
      price: productData.price,
      in_stock: productData.in_stock
    });

    return NextResponse.json({
      success: true,
      data: {
        ...productData,
        product_url: testProductUrl,
        extraction_time: endTime - startTime
      }
    });

  } catch (error: any) {
    console.error('❌ Test product extraction error:', error);

    // Fallback to build mode response on error
    if (isBuildMode()) {
      logBuildMode('test-product-error');
      return NextResponse.json({
        success: false,
        error: 'Product test failed in build mode',
        details: {
          message: error.message,
          code: error.code
        },
        buildMode: true
      });
    }

    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }, { status: 500 });
  }
}
