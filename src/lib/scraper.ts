import * as cheerio from 'cheerio';
import { ProxyManager } from './proxy-manager';
import { Category, Product, ProductLink, categoryService, productService, productLinkService } from './database-supabase';
import axios from 'axios';

export interface ScrapingProgress {
  category: string;
  currentPage: number;
  totalPages: number;
  currentProduct: number;
  totalProducts: number;
  successfulProducts: number;
  failedProducts: number;
  status: 'idle' | 'crawling_categories' | 'crawling_links' | 'crawling_products' | 'completed' | 'error';
}

export class BarnesNobleScraper {
  private progress: ScrapingProgress = {
    category: '',
    currentPage: 0,
    totalPages: 0,
    currentProduct: 0,
    totalProducts: 0,
    successfulProducts: 0,
    failedProducts: 0,
    status: 'idle'
  };

  private progressCallback?: (progress: ScrapingProgress) => void;
  private proxyManager: ProxyManager;

  constructor(proxyManager: ProxyManager, progressCallback?: (progress: ScrapingProgress) => void) {
    this.proxyManager = proxyManager;
    this.progressCallback = progressCallback;
  }



  // 20+ Advanced User Agents for rotation
  private readonly ADVANCED_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
  ];



  private updateProgress(updates: Partial<ScrapingProgress>) {
    this.progress = { ...this.progress, ...updates };
    if (this.progressCallback) {
      this.progressCallback(this.progress);
    }
  }

  private getRandomUserAgent(): string {
    return this.ADVANCED_USER_AGENTS[Math.floor(Math.random() * this.ADVANCED_USER_AGENTS.length)];
  }

  private isBlocked(html: string): boolean {
    const blockIndicators = [
      'captcha', 'blocked', 'access denied', 'cloudflare', 'please verify',
      'robot', 'security check', 'rate limit', 'too many requests', 'forbidden',
      'temporarily unavailable', 'service unavailable', 'bot detected',
      'suspicious activity', 'verify you are human', 'are you a robot'
    ];

    const lowerHtml = html.toLowerCase();

    // Check for block indicators
    const hasBlockIndicators = blockIndicators.some(indicator => lowerHtml.includes(indicator));

    // Check if it's actually Barnes & Noble content
    const hasBarnesNobleContent = lowerHtml.includes('barnes') && lowerHtml.includes('noble');
    const hasBookContent = lowerHtml.includes('book') || lowerHtml.includes('category') || lowerHtml.includes('browse');

    // If we have B&N content, it's probably not blocked
    if (hasBarnesNobleContent && hasBookContent) {
      console.log('✅ Detected valid Barnes & Noble content');
      return false;
    }

    // If content is too short, might be blocked
    if (html.length < 10000) {
      console.log('⚠️ Content too short, might be blocked');
      return true;
    }

    if (hasBlockIndicators) {
      console.log('🚫 Block indicators detected');
      return true;
    }

    console.log('✅ Content appears to be valid');
    return false;
  }

  private async makeAdvancedRequest(url: string, maxRetriesOrRetryCount = 20, forceProxyOrUseProxy = false): Promise<any> {
    // Handle backward compatibility with old signature (url, retryCount, useProxy)
    const maxRetries = maxRetriesOrRetryCount;
    const forceProxy = forceProxyOrUseProxy;
    let lastError: any;

    console.log(`🌐 Starting makeAdvancedRequest for: ${url}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Force proxy if requested (for batch operations), otherwise use adaptive strategy
        const useProxy = forceProxy || attempt > 3;
        const userAgent = this.getRandomUserAgent();

        console.log(`🔄 Attempt ${attempt}/${maxRetries} - ${useProxy ? 'PROXY' : 'DIRECT'} - UA: ${userAgent.substring(0, 50)}...`);
        console.log(`⏰ Starting request at: ${new Date().toISOString()}`);

        let response;

        if (useProxy) {
          // Use proxy with rotating user agent
          const axiosInstance = axios.create({
            proxy: {
              protocol: 'http',
              host: 'la.residential.rayobyte.com',
              port: 8000,
              auth: {
                username: 'iamyourproblems_gmail_com-dc',
                password: 'Shinichi123'
              }
            },
            timeout: 10000,
            headers: {
              'User-Agent': userAgent,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,de;q=0.7',
              'Accept-Encoding': 'gzip, deflate, br',
              'Cache-Control': Math.random() > 0.5 ? 'no-cache' : 'max-age=0',
              'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
              'Sec-Ch-Ua-Mobile': '?0',
              'Sec-Ch-Ua-Platform': '"Windows"',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': attempt === 1 ? 'none' : 'same-origin',
              'Sec-Fetch-User': '?1',
              'Upgrade-Insecure-Requests': '1',
              'Referer': attempt > 5 ? 'https://www.google.com/' : undefined
            }
          });

          response = await axiosInstance.get(url);
        } else {
          // Direct connection
          response = await axios.get(url, {
            timeout: 10000,
            headers: {
              'User-Agent': userAgent,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Cache-Control': 'no-cache',
              'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
              'Sec-Ch-Ua-Mobile': '?0',
              'Sec-Ch-Ua-Platform': '"Windows"',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'none',
              'Sec-Fetch-User': '?1',
              'Upgrade-Insecure-Requests': '1'
            }
          });
        }

        console.log(`✅ Response: ${response.status}, Content: ${response.data.length} chars`);

        // Check if response is blocked - but be more tolerant
        if (this.isBlocked(response.data)) {
          if (attempt >= maxRetries) {
            console.log(`🚫 Final attempt - accepting potentially blocked response`);
            return response; // Accept it on final attempt
          } else {
            console.log(`🚫 Response appears to be blocked/captcha - retrying ${maxRetries - attempt} more times`);
            throw new Error('Response blocked or captcha detected');
          }
        }

        // Check if response is HTML error instead of expected content
        if (response.data.includes('<html>') && response.data.includes('error')) {
          if (attempt >= maxRetries) {
            console.log(`❌ Final attempt - accepting error page`);
            return response; // Accept it on final attempt
          } else {
            console.log(`❌ Received HTML error page - retrying ${maxRetries - attempt} more times`);
            throw new Error('HTML error page received');
          }
        }

        return response;

      } catch (error: any) {
        lastError = error;

        console.log(`❌ Attempt ${attempt} failed: ${error.message}`);

        // Analyze error type and adjust strategy
        if (error.code === 'ECONNABORTED') {
          console.log(`⏰ Timeout - server slow, continuing with retries`);
        } else if (error.code === 'ECONNREFUSED') {
          console.log(`🔒 Connection refused - switching to proxy`);
        } else if (error.response?.status === 403) {
          console.log(`🚫 Forbidden (403) - bot detected, retry ${maxRetries - attempt} more times`);
        } else if (error.response?.status === 429) {
          console.log(`⏱️ Rate limited (429) - adding extra delay, retry ${maxRetries - attempt} more times`);
        } else if (error.response?.status === 503) {
          console.log(`🚧 Service unavailable (503) - retry ${maxRetries - attempt} more times`);
        } else if (error.response?.status === 520 || error.response?.status === 521 || error.response?.status === 522) {
          console.log(`☁️ Cloudflare error (${error.response?.status}) - retry ${maxRetries - attempt} more times`);
        } else if (error.message.includes('blocked') || error.message.includes('captcha')) {
          console.log(`🤖 Bot/captcha detected - retry ${maxRetries - attempt} more times`);
        }

        if (attempt < maxRetries) {
          // Progressive delay with randomization - longer delays for rate limiting
          let baseDelay;
          if (error.response?.status === 429) {
            baseDelay = Math.min(5000 + (attempt * 2000), 15000); // Longer delay for rate limits
          } else if (error.response?.status === 403 || error.message.includes('blocked')) {
            baseDelay = Math.min(3000 + (attempt * 1500), 12000); // Medium delay for blocking
          } else {
            baseDelay = Math.min(1000 + (attempt * 500), 5000); // Shorter delay for other errors
          }

          const jitter = Math.random() * 2000;
          const delay = baseDelay + jitter;

          console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`❌ All ${maxRetries} attempts failed. Last error: ${lastError?.message}`);
  }

  /**
   * Crawl all categories from Barnes & Noble browse page
   */
  async crawlCategories(): Promise<Category[]> {
    console.log('🚀 Starting category crawl from Barnes & Noble...');

    try {
      console.log('📊 Setting progress to crawling_categories...');
      this.updateProgress({
        status: 'crawling_categories',
        category: 'Browse Page',
        currentPage: 1,
        totalPages: 1
      });

      const browseUrl = 'https://www.barnesandnoble.com/h/books/browse';
      console.log('🎯 Target URL:', browseUrl);

      console.log('📡 Trying simple direct request first...');

      // Try simple direct request first (no proxy, no complex retry)
      let response;
      try {
        response = await axios.get(browseUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          },
          validateStatus: (status) => status < 500 // Accept 403, 429 etc but not 500+ errors
        });
        console.log(`✅ Simple direct request successful! Status: ${response.status}`);
      } catch (simpleError: any) {
        console.log(`❌ Simple request failed (${simpleError.message}), trying advanced method with 20 retries...`);
        response = await this.makeAdvancedRequest(browseUrl);
        console.log('✅ Advanced request completed!');
      }

      console.log(`✅ Response received: ${response.status}, Content: ${response.data.length} chars`);

      if (this.isBlocked(response.data)) {
        throw new Error('Response appears to be blocked or captcha detected');
      }

      // Parse HTML with cheerio
      const $ = cheerio.load(response.data);
      const categories: Category[] = [];

      console.log('🔍 Parsing categories from browse page...');

      // Multiple selectors to capture all possible category links
      const categorySelectors = [
        'a[href*="/b/books/"]',
        'a[href*="/books/"]',
        'a[href*="category"]',
        'a[href*="browse"]',
        '.category-link',
        '.browse-link',
        '.nav-link',
        'nav a',
        '.menu a',
        '.navigation a'
      ];

      const foundUrls = new Set<string>();
      const bookKeywords = [
        'fiction', 'mystery', 'romance', 'science', 'history', 'biography',
        'children', 'young', 'teen', 'adult', 'fantasy', 'horror', 'thriller',
        'business', 'health', 'travel', 'cooking', 'art', 'religion', 'poetry',
        'drama', 'humor', 'self-help', 'education', 'reference', 'textbook',
        'graphic', 'comic', 'manga', 'literature', 'classic', 'contemporary'
      ];

      for (const selector of categorySelectors) {
        $(selector).each((index, element) => {
          const $link = $(element);
          let href = $link.attr('href');
          const text = $link.text().trim();

          if (!href || !text || text.length < 3 || text.length > 100) return;

          // Clean and normalize URL
          if (href.startsWith('/')) {
            href = `https://www.barnesandnoble.com${href}`;
          }

          // Filter for book-related categories
          const textLower = text.toLowerCase();
          const hrefLower = href.toLowerCase();

          const isBookRelated = bookKeywords.some(keyword =>
            textLower.includes(keyword) || hrefLower.includes(keyword)
          ) || hrefLower.includes('/b/books/') || hrefLower.includes('/books/');

          // Additional filters
          const isValid = !textLower.includes('gift') &&
                         !textLower.includes('member') &&
                         !textLower.includes('account') &&
                         !textLower.includes('help') &&
                         !textLower.includes('store') &&
                         !textLower.includes('sign') &&
                         !href.includes('#') &&
                         !href.includes('javascript:') &&
                         !href.includes('mailto:');

          if (isBookRelated && isValid && !foundUrls.has(href)) {
            foundUrls.add(href);

            const category: Category = {
              name: text,
              url: href,
              status: 'pending'
            };

            categories.push(category);
            console.log(`📁 Found category: ${text} -> ${href}`);
          }
        });
      }

      // If we found very few categories, try a broader search
      if (categories.length < 10) {
        console.log('🔍 Found few categories, trying broader search...');

        $('a').each((index, element) => {
          const $link = $(element);
          let href = $link.attr('href');
          const text = $link.text().trim();

          if (!href || !text || text.length < 3 || text.length > 80) return;

          if (href.startsWith('/')) {
            href = `https://www.barnesandnoble.com${href}`;
          }

          const textLower = text.toLowerCase();
          const hrefLower = href.toLowerCase();

          // Look for any book-related content
          const hasBookContent = hrefLower.includes('book') ||
                                hrefLower.includes('/b/') ||
                                bookKeywords.some(keyword => textLower.includes(keyword));

          const isCategory = textLower.includes('fiction') ||
                           textLower.includes('non-fiction') ||
                           textLower.includes('mystery') ||
                           textLower.includes('romance') ||
                           textLower.includes('children') ||
                           textLower.includes('teen') ||
                           textLower.includes('young adult') ||
                           textLower.includes('science') ||
                           textLower.includes('history') ||
                           textLower.includes('biography');

          if ((hasBookContent || isCategory) && !foundUrls.has(href)) {
            foundUrls.add(href);

            categories.push({
              name: text,
              url: href,
              status: 'pending'
            });

            console.log(`📂 Broader search found: ${text} -> ${href}`);
          }
        });
      }

      console.log(`🎉 Total categories found: ${categories.length}`);

      if (categories.length === 0) {
        console.log('⚠️ No categories found, checking page content...');
        console.log('📄 Page title:', $('title').text());
        console.log('📄 First 500 chars:', response.data.substring(0, 500));

        throw new Error('No categories found on browse page');
      }

      // Save categories to database
      for (const category of categories) {
        try {
          await categoryService.insert().run(
            category.name,
            category.url,
            null, // bestseller_url will be filled later
            'pending'
          );
          console.log(`💾 Saved category: ${category.name}`);
        } catch (error: any) {
          if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
            console.log(`⚠️ Category already exists: ${category.name}`);
          } else {
            console.error(`❌ Error saving category ${category.name}:`, error);
          }
        }
      }

      this.updateProgress({
        status: 'completed',
        category: 'Browse Page',
        currentPage: 1,
        totalPages: 1
      });

      console.log(`✅ Successfully crawled ${categories.length} categories`);
      return categories;

    } catch (error: any) {
      console.error('❌ Category crawling failed:', error);
      this.updateProgress({
        status: 'error',
        category: 'Browse Page'
      });
      throw error;
    }
  }

  /**
   * Find bestseller links for a specific category (with proxy support for batch)
   */
  async findBestsellerLinks(categoryId: number, categoryUrl: string, useProxyFirst = false): Promise<string | null> {
    console.log(`🔍 Finding bestseller link for category: ${categoryUrl}`);

    try {
      const response = await this.makeAdvancedRequest(categoryUrl, 20, useProxyFirst);
      const $ = cheerio.load(response.data);

      console.log(`📄 Page loaded, content length: ${response.data.length} chars`);

      // Enhanced selectors based on actual Barnes & Noble structure
      const bestsellerSelectors = [
        // Exact structure from B&N: Bestsellers "See All" link
        '.record-spotlight-header a.see-all-link',
        'header.record-spotlight-header a.see-all-link',
        '.product-editorial-see-all-link a.see-all-link',

        // Barnes & Noble sales rank parameter (most reliable)
        'a[href*="Ns=P_Sales_Rank"]',
        'a[href*="P_Sales_Rank"]',

        // "See All" links near "Bestsellers" text
        'a:contains("See All")',
        '.see-all-link',
        'a.see-all-link',

        // Header structure variations
        '.record-spotlight-header a',
        '.product-editorial-see-all-link a',
        'header:contains("Bestsellers") a',
        'h2:contains("Bestsellers") + a',

        // Direct bestseller links
        'a[href*="bestseller"]',
        'a[href*="best-seller"]',
        'a[href*="best_seller"]',

        // Sort/filter links
        'a[href*="sort=bestselling"]',
        'a[href*="sort=popular"]',
        'a[href*="sort=sales"]',
        'a[href*="orderBy=sales"]',
        'a[href*="orderBy=popularity"]',

        // Text-based matching
        'a:contains("Best Seller")',
        'a:contains("Bestseller")',
        'a:contains("Bestselling")',
        'a:contains("Top 100")',
        'a:contains("Most Popular")',
        'a:contains("Popular")',

        // Fallback selectors
        '.bestseller-link',
        '.best-sellers',
        '#bestseller',
        '[data-sort*="sales"]',
        '[data-sort*="popular"]'
      ];

      console.log(`🔍 Searching with ${bestsellerSelectors.length} different selectors...`);

      for (const selector of bestsellerSelectors) {
        const $links = $(selector);
        console.log(`   ${selector}: ${$links.length} matches`);

        if ($links.length > 0) {
          const $link = $links.first();
          let href = $link.attr('href');
          const text = $link.text().trim();

          console.log(`   Found: "${text}" -> ${href}`);

          if (href) {
            // Normalize URL
            if (href.startsWith('/')) {
              href = `https://www.barnesandnoble.com${href}`;
            }

            // Clean up jsessionid and other unwanted parameters
            href = href.split(';jsessionid=')[0];
            href = href.split('&jsessionid=')[0];
            href = href.split('?jsessionid=')[0];

            console.log(`✅ Found bestseller URL with "${selector}": ${href}`);

            // Update category in database
            await categoryService.updateBestsellerUrl().run(href, categoryId);
            return href;
          }
        }
      }

      console.log(`📋 No direct bestseller links found. Trying fallback strategies...`);

      // Strategy 1: Try multiple constructed URLs based on B&N structure
      const possibleUrls = [
        // Barnes & Noble sales rank (exact pattern from user's example)
        categoryUrl.includes('?') ? `${categoryUrl}&Ns=P_Sales_Rank` : `${categoryUrl}?Ns=P_Sales_Rank`,
        categoryUrl.includes('?') ? `${categoryUrl}&Ns=P_Sales_Rank|0` : `${categoryUrl}?Ns=P_Sales_Rank|0`,
        categoryUrl.includes('?') ? `${categoryUrl}&Ns=P_Sales_Rank|1` : `${categoryUrl}?Ns=P_Sales_Rank|1`,

        // Other common sort parameters
        categoryUrl.includes('?') ? `${categoryUrl}&sort=bestselling` : `${categoryUrl}?sort=bestselling`,
        categoryUrl.includes('?') ? `${categoryUrl}&sort=popular` : `${categoryUrl}?sort=popular`,
      ];

      for (const testUrl of possibleUrls) {
        console.log(`🧪 Testing constructed URL: ${testUrl}`);

        try {
          const testResponse = await this.makeAdvancedRequest(testUrl);
          console.log(`✅ Constructed URL works! Status: ${testResponse.status}`);

          // Clean up the URL before saving
          let cleanUrl = testUrl.split(';jsessionid=')[0];
          cleanUrl = cleanUrl.split('&jsessionid=')[0];
          cleanUrl = cleanUrl.split('?jsessionid=')[0];

          // Update category in database
          await categoryService.updateBestsellerUrl().run(cleanUrl, categoryId);
          return cleanUrl;
        } catch (error) {
          console.log(`❌ Constructed URL failed: ${testUrl}`);
        }
      }

      // Strategy 2: Use original URL as fallback (might still have bestsellers)
      console.log(`📝 Using original category URL as fallback: ${categoryUrl}`);
      await categoryService.updateBestsellerUrl().run(categoryUrl, categoryId);
      return categoryUrl;

    } catch (error: any) {
      console.error(`❌ Error finding bestseller link: ${error.message}`);

      // Final fallback: use original URL
      console.log(`🔄 Final fallback: using original category URL`);
      await categoryService.updateBestsellerUrl().run(categoryUrl, categoryId);
      return categoryUrl;
    }
  }

  /**
   * Crawl product links from bestseller pages (with proxy support for batch)
   */
  async crawlProductLinks(categoryId: number, bestsellerUrl: string, startPage: number = 1, endPage: number = 50, useProxyFirst = false): Promise<void> {
    console.log(`🔗 Starting product links crawl for category ${categoryId}`);
    console.log(`📄 Pages: ${startPage} to ${endPage}`);

    this.updateProgress({
      status: 'crawling_links',
      category: `Category ${categoryId}`,
      currentPage: 0,
      totalPages: endPage - startPage + 1
    });

    const productLinks: any[] = [];

    for (let page = startPage; page <= endPage; page++) {
      try {
        console.log(`📄 Crawling page ${page}/${endPage}...`);

        this.updateProgress({
          status: 'crawling_links',
          category: `Category ${categoryId}`,
          currentPage: page - startPage + 1,
          totalPages: endPage - startPage + 1
        });

        // Construct page URL
        const pageUrl = bestsellerUrl.includes('?')
          ? `${bestsellerUrl}&page=${page}`
          : `${bestsellerUrl}?page=${page}`;

        const response = await this.makeAdvancedRequest(pageUrl, 20, useProxyFirst);
        const $ = cheerio.load(response.data);

        // Extract product links with enhanced filtering
        const pageLinks: any[] = [];
        const foundUrls = new Set<string>(); // Prevent duplicates

        console.log(`📄 Page ${page} content length: ${response.data.length} chars`);

        // Enhanced selectors for actual product links
        const productSelectors = [
          'a[href*="/w/"][href*="?ean="]',  // Primary: /w/ links with EAN (most reliable)
          'a[href^="/w/"]',                 // Links starting with /w/
          'a[href*="/w/"]',                 // Any links containing /w/
        ];

        for (const selector of productSelectors) {
          const $productLinks = $(selector);
          console.log(`   ${selector}: ${$productLinks.length} matches`);

          $productLinks.each((index, element) => {
            const $link = $(element);
            let href = $link.attr('href');
            const linkText = $link.text().trim();

            if (href && href.includes('/w/')) {
              // Normalize URL
              if (href.startsWith('/')) {
                href = `https://www.barnesandnoble.com${href}`;
              }

              // Clean URL (remove jsessionid)
              href = href.split(';jsessionid=')[0];
              href = href.split('&jsessionid=')[0];
              href = href.split('?jsessionid=')[0];

              // Validate it's a real product URL
              const isValidProduct = (
                href.includes('/w/') &&                           // Contains /w/ path
                href.includes('/') &&                             // Has proper URL structure
                linkText.length > 0 &&                            // Has link text
                !href.includes('javascript:') &&                 // Not a JS link
                !href.includes('#') &&                            // Not an anchor
                !href.includes('mailto:') &&                      // Not email
                !foundUrls.has(href)                              // Not duplicate
              );

              if (isValidProduct) {
                foundUrls.add(href);
                pageLinks.push({
                  url: href,
                  category_id: categoryId,
                  page_number: page,
                  rank_in_page: pageLinks.length + 1, // Use array position for ranking
                  link_text: linkText.substring(0, 100) // Store for debugging
                });

                // Debug first few links
                if (pageLinks.length <= 5) {
                  console.log(`      Product ${pageLinks.length}: "${linkText.substring(0, 50)}" -> ${href}`);
                }
              }
            }
          });

          // If we found products with this selector, we can break
          if (pageLinks.length > 0) break;
        }

        console.log(`📖 Found ${pageLinks.length} unique product links on page ${page}`);
        productLinks.push(...pageLinks);

        // Random delay between pages
        if (page < endPage) {
          const delay = 1000 + Math.random() * 2000;
          console.log(`⏳ Waiting ${Math.round(delay)}ms before next page...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error: any) {
        console.error(`❌ Error crawling page ${page}: ${error.message}`);
        // Continue with next page
      }
    }

    // Save all product links to database
    if (productLinks.length > 0) {
      console.log(`💾 Saving ${productLinks.length} product links to database...`);
      await productLinkService.insertBatch(productLinks);
      console.log(`✅ Saved ${productLinks.length} product links`);
    }

    this.updateProgress({
      status: 'completed',
      category: `Category ${categoryId}`,
      currentPage: endPage - startPage + 1,
      totalPages: endPage - startPage + 1
    });
  }

  /**
   * Crawl detailed product information with enhanced ISBN and book format extraction
   */
  async crawlProductDetails(productUrl: string): Promise<any> {
    try {
      const response = await this.makeAdvancedRequest(productUrl);
      const $ = cheerio.load(response.data);

      console.log(`📄 Product page content length: ${response.data.length} chars`);

      // Extract title with multiple selectors
      const title = $('.product-title, h1, .pdp-product-title, .book-title, [data-testid="product-title"]').first().text().trim() ||
                   $('h1').first().text().trim() ||
                   $('title').text().replace(' | Barnes & Noble®', '').trim();

      console.log(`📖 Title found: "${title}"`);

      // Enhanced ISBN/EAN extraction with multiple methods (prioritize URL)
      let isbn = null;

      // Method 1: Extract from URL parameters (most reliable for B&N)
      const urlMatch = productUrl.match(/[?&]ean=([0-9]{10,13})/i);
      if (urlMatch) {
        isbn = urlMatch[1];
        console.log(`📘 ISBN from URL parameter: ${isbn}`);
      }

      // Method 2: Data attributes
      if (!isbn) {
        isbn = $('[data-isbn]').attr('data-isbn') ||
               $('[data-ean]').attr('data-ean') ||
               $('[data-product-isbn]').attr('data-product-isbn') ||
               $('[data-product-ean]').attr('data-product-ean');
        if (isbn) console.log(`📘 ISBN from data attributes: ${isbn}`);
      }

      // Method 3: Meta tags
      if (!isbn) {
        isbn = $('meta[name="isbn"]').attr('content') ||
               $('meta[property="isbn"]').attr('content') ||
               $('meta[name="book:isbn"]').attr('content');
        if (isbn) console.log(`📘 ISBN from meta tags: ${isbn}`);
      }

      // Method 4: Text content search with enhanced patterns
      if (!isbn) {
        const isbnSelectors = [
          '.isbn', '.product-isbn', '.book-details', '.product-details',
          '.product-info', '.book-info', '.item-details', '.publication-details'
        ];
        for (const selector of isbnSelectors) {
          const text = $(selector).text();
          const isbnMatch = text.match(/(?:ISBN|EAN)[:\s-]*([0-9]{10,13})/i);
          if (isbnMatch) {
            isbn = isbnMatch[1];
            console.log(`📘 ISBN from text content (${selector}): ${isbn}`);
            break;
          }
        }
      }

      // Method 5: Search entire page for ISBN pattern
      if (!isbn) {
        const pageText = $.text();
        const isbnMatches = pageText.match(/(?:ISBN|EAN)[:\s-]*([0-9]{10,13})/gi);
        if (isbnMatches && isbnMatches.length > 0) {
          // Get the first valid ISBN (usually the main product)
          for (const match of isbnMatches) {
            const isbnPart = match.match(/([0-9]{10,13})/);
            if (isbnPart) {
              isbn = isbnPart[1];
              console.log(`📘 ISBN from page text: ${isbn}`);
              break;
            }
          }
        }
      }

      console.log(`📘 Final ISBN result: ${isbn || 'NOT FOUND'}`);

      // Enhanced book format/type extraction
      const formatSelectors = [
        '.format', '.product-format', '.book-format', '.edition',
        '.format-type', '.book-type', '.publication-format',
        '.format-selector', '.format-option', '.item-format',
        '.binding', '.binding-type', '.book-binding'
      ];

      let bookFormat = null;
      for (const selector of formatSelectors) {
        const formatText = $(selector).first().text().trim();
        if (formatText) {
          bookFormat = formatText;
          console.log(`📚 Format from ${selector}: ${formatText}`);
          break;
        }
      }

      // Look for format in title or description if not found in specific selectors
      if (!bookFormat) {
        const titleAndDesc = (title + ' ' + ($('.product-description').text() || '')).toLowerCase();
        const formatPatterns = [
          /hardcover/i, /paperback/i, /mass market/i, /trade paperback/i,
          /ebook/i, /kindle/i, /audiobook/i, /audio cd/i,
          /board book/i, /spiral-bound/i, /leather bound/i
        ];

        for (const pattern of formatPatterns) {
          if (pattern.test(titleAndDesc)) {
            bookFormat = titleAndDesc.match(pattern)?.[0] || null;
            if (bookFormat) {
              console.log(`📚 Format from content analysis: ${bookFormat}`);
              break;
            }
          }
        }
      }

      // Look in URL for format clues
      if (!bookFormat) {
        const urlLower = productUrl.toLowerCase();
        if (urlLower.includes('hardcover')) bookFormat = 'Hardcover';
        else if (urlLower.includes('paperback')) bookFormat = 'Paperback';
        else if (urlLower.includes('ebook')) bookFormat = 'eBook';
        else if (urlLower.includes('audio')) bookFormat = 'Audiobook';

        if (bookFormat) console.log(`📚 Format from URL: ${bookFormat}`);
      }

      console.log(`📚 Final book format: ${bookFormat || 'NOT FOUND'}`);

      // Enhanced price extraction
      const priceSelectors = [
        '.price', '.current-price', '.sale-price', '.product-price',
        '[data-testid="price"]', '.price-current', '.price-value',
        '.pdp-price', '.book-price', '.price-display', '.current'
      ];

      let priceText = '';
      for (const selector of priceSelectors) {
        priceText = $(selector).first().text().trim();
        if (priceText && priceText.includes('$')) {
          console.log(`💰 Price selector used: ${selector} -> "${priceText}"`);
          break;
        }
      }

      const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : null;
      console.log(`💰 Price found: ${price || 'N/A'} (from "${priceText}")`);

      // Enhanced original price extraction
      const originalPriceSelectors = [
        '.original-price', '.list-price', '.msrp', '.price-original',
        '.was-price', '.price-strike', '.price-crossed', '.regular-price',
        '.price-was', '.strikethrough', '.price-compare'
      ];

      let originalPriceText = '';
      for (const selector of originalPriceSelectors) {
        originalPriceText = $(selector).first().text().trim();
        if (originalPriceText && originalPriceText.includes('$')) {
          console.log(`💵 Original price selector used: ${selector} -> "${originalPriceText}"`);
          break;
        }
      }

      const originalPrice = originalPriceText ? parseFloat(originalPriceText.replace(/[^0-9.]/g, '')) : null;
      console.log(`💵 Original price found: ${originalPrice || 'N/A'} (from "${originalPriceText}")`);

      // Enhanced stock status
      const stockSelectors = [
        '.availability', '.stock-status', '.in-stock', '.inventory-status',
        '[data-testid="availability"]', '.product-availability',
        '.availability-status', '.stock-info'
      ];

      let inStockText = '';
      for (const selector of stockSelectors) {
        const text = $(selector).text().toLowerCase();
        if (text) {
          inStockText += text + ' ';
        }
      }

      const inStock = !inStockText.includes('out of stock') &&
                     !inStockText.includes('unavailable') &&
                     !inStockText.includes('sold out') &&
                     !inStockText.includes('not available') &&
                     !inStockText.includes('coming soon');

      console.log(`📦 Stock status: ${inStock ? 'IN STOCK' : 'OUT OF STOCK'} (from "${inStockText.trim()}")`);

      // Extract additional fields
      const author = $('.contributor, .author, .book-author, .product-contributor, .by-author').first().text().trim() || null;
      console.log(`✍️ Author found: ${author || 'N/A'}`);

      const description = $('.product-description, .book-description, .product-summary, .synopsis').first().text().trim().substring(0, 500) || null;
      console.log(`📝 Description found: ${description ? 'YES' : 'N/A'} (${description?.length || 0} chars)`);

      const rating = $('.rating, .stars, .product-rating, .star-rating').first().text().trim() || null;
      console.log(`⭐ Rating found: ${rating || 'N/A'}`);

      if (!title) {
        throw new Error('Could not extract product title');
      }

      return {
        title,
        isbn,
        price,
        original_price: originalPrice,
        book_format: bookFormat,
        author,
        description,
        rating,
        product_url: productUrl,
        in_stock: inStock
      };

    } catch (error: any) {
      console.error(`❌ Error crawling product details for ${productUrl}: ${error.message}`);
      return null;
    }
  }

  getProgress(): ScrapingProgress {
    return this.progress;
  }

  // Method aliases for API compatibility
  async findBestsellerUrl(categoryUrl: string): Promise<string | null> {
    // For compatibility, we'll create a temporary category entry
    const tempCategory = await categoryService.insert().run(
      'Temp Category',
      categoryUrl,
      null,
      'temp'
    );

    const result = await this.findBestsellerLinks(tempCategory.id, categoryUrl, true);

    // Clean up temp category
    // Note: In production, you might want to handle this differently

    return result;
  }

  async extractProductLinks(pageUrl: string): Promise<{ url: string; text?: string }[]> {
    try {
      console.log(`🌐 [SCRAPER] Starting link extraction from: ${pageUrl}`);
      const startTime = Date.now();

      const response = await this.makeAdvancedRequest(pageUrl, 20, true);
      const requestTime = Date.now() - startTime;

      console.log(`📥 [SCRAPER] Page loaded in ${requestTime}ms, content: ${response.data.length} chars`);

      const $ = cheerio.load(response.data);

      const links: { url: string; text?: string }[] = [];
      const foundUrls = new Set<string>();

      // Enhanced selectors for actual product links
      const productSelectors = [
        'a[href*="/w/"][href*="?ean="]',  // Primary: /w/ links with EAN (most reliable)
        'a[href^="/w/"]',                 // Links starting with /w/
        'a[href*="/w/"]',                 // Any links containing /w/
      ];

      console.log(`🔍 [SCRAPER] Searching for product links with ${productSelectors.length} selectors...`);

      for (let i = 0; i < productSelectors.length; i++) {
        const selector = productSelectors[i];
        const $productLinks = $(selector);
        console.log(`   [SCRAPER] Selector ${i + 1}: "${selector}" found ${$productLinks.length} matches`);

        $productLinks.each((index, element) => {
          const $link = $(element);
          let href = $link.attr('href');
          const linkText = $link.text().trim();

          if (href && href.includes('/w/')) {
            // Normalize URL
            if (href.startsWith('/')) {
              href = `https://www.barnesandnoble.com${href}`;
            }

            // Clean URL (remove jsessionid)
            href = href.split(';jsessionid=')[0];
            href = href.split('&jsessionid=')[0];
            href = href.split('?jsessionid=')[0];

            // Validate it's a real product URL
            const isValidProduct = (
              href.includes('/w/') &&                           // Contains /w/ path
              href.includes('/') &&                             // Has proper URL structure
              linkText.length > 0 &&                            // Has link text
              !href.includes('javascript:') &&                 // Not a JS link
              !href.includes('#') &&                            // Not an anchor
              !href.includes('mailto:') &&                      // Not email
              !foundUrls.has(href)                              // Not duplicate
            );

            if (isValidProduct) {
              foundUrls.add(href);
              links.push({
                url: href,
                text: linkText
              });

              // Log first few links found
              if (links.length <= 3) {
                console.log(`   [SCRAPER] Link ${links.length}: "${linkText.substring(0, 40)}..." -> ${href}`);
              }
            }
          }
        });

        // If we found products with this selector, we can break
        if (links.length > 0) {
          console.log(`✅ [SCRAPER] Found ${links.length} links with selector: "${selector}"`);
          break;
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`🔗 [SCRAPER] Extracted ${links.length} product links from ${pageUrl} in ${totalTime}ms`);

      if (links.length === 0) {
        console.log(`⚠️ [SCRAPER] No product links found! Page might be blocked or structure changed`);
        console.log(`📄 [SCRAPER] Page title: ${$('title').text()}`);
        console.log(`📄 [SCRAPER] Page content preview: ${response.data.substring(0, 200)}...`);
      }

      return links;
    } catch (error) {
      console.error(`❌ [SCRAPER] Error extracting product links from ${pageUrl}:`, error);
      return [];
    }
  }

  async extractProductData(productUrl: string): Promise<any> {
    return this.crawlProductDetails(productUrl);
  }
}

export default BarnesNobleScraper;
