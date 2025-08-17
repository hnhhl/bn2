import { NextRequest, NextResponse } from 'next/server';
import { ProxyManager } from '@/lib/proxy-manager';
import { BarnesNobleScraper } from '@/lib/scraper';

export async function GET() {
  try {
    console.log('🛍️ Testing product data extraction...');

    // Use a known Barnes & Noble product URL for testing
    const testProductUrl = 'https://www.barnesandnoble.com/w/the-seven-husbands-of-evelyn-hugo-taylor-jenkins-reid/1126606449';

    const proxyManager = new ProxyManager();
    const scraper = new BarnesNobleScraper(proxyManager);

    const productData = await scraper.extractProductData(testProductUrl);

    if (productData) {
      console.log('✅ Product extraction successful:', productData.title);

      return NextResponse.json({
        success: true,
        data: {
          ...productData,
          test_url: testProductUrl,
          extracted_at: new Date().toISOString()
        }
      });
    } else {
      console.log('❌ No product data extracted');

      return NextResponse.json({
        success: false,
        error: 'No product data could be extracted',
        details: {
          test_url: testProductUrl,
          possible_reasons: [
            'Product page structure changed',
            'Product not available',
            'Blocked by anti-bot measures',
            'Network/proxy issues'
          ]
        }
      });
    }

  } catch (error: any) {
    console.error('❌ Product extraction test failed:', error.message);

    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }, { status: 500 });
  }
}
