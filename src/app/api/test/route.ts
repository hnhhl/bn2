import { NextRequest, NextResponse } from 'next/server';
import { BarnesNobleScraper } from '@/lib/scraper';
import { ProxyManager } from '@/lib/proxy-manager';
import { isBuildMode, createBuildModeResponse, logBuildMode } from '@/lib/build-utils';

export async function GET(request: NextRequest) {
  try {
    // Check for build mode
    if (isBuildMode()) {
      logBuildMode('test');
      return NextResponse.json({
        success: true,
        data: {
          status: 200,
          contentLength: 5000,
          isBlocked: false,
          hasBarnesNobleContent: true,
          hasNavigation: true,
          hasCategories: true,
          redirects: 0,
          userAgent: 'Build mode test',
          sampleLinks: [
            { type: 'category', text: 'Fiction', url: 'https://example.com/fiction' },
            { type: 'category', text: 'Non-Fiction', url: 'https://example.com/non-fiction' }
          ]
        },
        buildMode: true,
        message: 'Test data in build mode'
      });
    }

    const { searchParams } = new URL(request.url);
    const useProxy = searchParams.get('proxy') === 'true';

    console.log(`🧪 Testing Barnes & Noble connection ${useProxy ? 'WITH' : 'WITHOUT'} proxy...`);

    const proxyManager = new ProxyManager();
    const scraper = new BarnesNobleScraper(proxyManager);

    // Test URL - Barnes & Noble homepage
    const testUrl = 'https://www.barnesandnoble.com/';

    const startTime = Date.now();
    const response = await scraper['makeAdvancedRequest'](testUrl, 3, useProxy);
    const endTime = Date.now();

    const content = response.data;
    const contentLength = content.length;

    // Analyze the response
    const isBlocked = scraper['isBlocked'](content);
    const hasBarnesNobleContent = content.toLowerCase().includes('barnes') && content.toLowerCase().includes('noble');
    const hasNavigation = content.toLowerCase().includes('nav') || content.toLowerCase().includes('menu');
    const hasCategories = content.toLowerCase().includes('category') || content.toLowerCase().includes('browse');

    // Extract sample links for analysis
    const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    const sampleLinks: any[] = [];
    let match;
    let linkCount = 0;

    while ((match = linkRegex.exec(content)) !== null && linkCount < 10) {
      const url = match[1];
      const text = match[2].trim();

      if (text && url && !url.includes('javascript:') && !url.includes('#')) {
        let linkType = 'other';
        if (url.includes('/b/books/') || url.includes('category')) {
          linkType = 'category';
        } else if (url.includes('/w/')) {
          linkType = 'product';
        }

        sampleLinks.push({
          type: linkType,
          text: text.substring(0, 50),
          url: url.startsWith('/') ? `https://www.barnesandnoble.com${url}` : url
        });
        linkCount++;
      }
    }

    const result = {
      status: response.status,
      contentLength,
      responseTime: endTime - startTime,
      isBlocked,
      hasBarnesNobleContent,
      hasNavigation,
      hasCategories,
      redirects: response.request?.redirected ? 1 : 0,
      userAgent: response.config?.headers?.['User-Agent'] || 'Unknown',
      sampleLinks,
      contentPreview: content.substring(0, 500)
    };

    console.log(`✅ Test completed:`, {
      status: result.status,
      contentLength: result.contentLength,
      isBlocked: result.isBlocked,
      linksFound: result.sampleLinks.length
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('❌ Test connection error:', error);

    // Fallback to build mode response on error
    if (isBuildMode()) {
      logBuildMode('test-error');
      return NextResponse.json({
        success: false,
        error: 'Test failed in build mode',
        details: {
          message: error.message,
          code: error.code,
          timeout: error.code === 'ECONNABORTED',
          dnsError: error.code === 'ENOTFOUND'
        },
        buildMode: true
      });
    }

    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        message: error.message,
        code: error.code,
        timeout: error.code === 'ECONNABORTED',
        dnsError: error.code === 'ENOTFOUND'
      }
    }, { status: 500 });
  }
}
