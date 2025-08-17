import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

const PROXY_CONFIG = {
  host: 'la.residential.rayobyte.com',
  port: 8000,
  auth: {
    username: 'iamyourproblems_gmail_com-dc',
    password: 'Shinichi123'
  }
};

const REFERERS = [
  'https://www.google.com/',
  'https://www.bing.com/',
  'https://duckduckgo.com/',
  'https://www.yahoo.com/search',
  'https://search.yahoo.com/',
  ''  // No referer sometimes
];

export class ProxyManager {
  private static instance: ProxyManager;
  private currentUserAgentIndex = 0;
  private requestCount = 0;

  static getInstance(): ProxyManager {
    if (!ProxyManager.instance) {
      ProxyManager.instance = new ProxyManager();
    }
    return ProxyManager.instance;
  }

  getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  getNextUserAgent(): string {
    const userAgent = USER_AGENTS[this.currentUserAgentIndex];
    this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % USER_AGENTS.length;
    return userAgent;
  }

  getRandomReferer(): string {
    return REFERERS[Math.floor(Math.random() * REFERERS.length)];
  }

  createRealisticHeaders(userAgent?: string): any {
    const ua = userAgent || this.getRandomUserAgent();
    const referer = this.getRandomReferer();

    const headers: any = {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': Math.random() > 0.5 ? 'max-age=0' : 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': this.requestCount === 0 ? 'none' : 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Connection': 'keep-alive'
    };

    // Add referer randomly
    if (referer) {
      headers['Referer'] = referer;
    }

    // Vary some headers randomly
    if (Math.random() > 0.7) {
      headers['DNT'] = '1';
    }

    if (Math.random() > 0.8) {
      headers['Pragma'] = 'no-cache';
    }

    this.requestCount++;
    return headers;
  }

  createAxiosInstance(useProxy: boolean = true): AxiosInstance {
    const headers = this.createRealisticHeaders();

    const config: any = {
      timeout: 45000,
      maxRedirects: 5,
      validateStatus: (status: number) => status < 500,
      headers
    };

    if (useProxy) {
      config.proxy = {
        protocol: 'http',
        host: PROXY_CONFIG.host,
        port: PROXY_CONFIG.port,
        auth: PROXY_CONFIG.auth
      };

      // Additional proxy settings
      config.httpsAgent = null; // Let axios handle HTTPS
      config.httpAgent = null;
    }

    return axios.create(config);
  }

  async makeRequest(url: string, config?: AxiosRequestConfig, maxRetries = 20): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Try different strategies based on attempt
        let useProxy: boolean;
        if (attempt === 1) {
          useProxy = false; // Try direct first (since direct worked)
        } else if (attempt <= 10) {
          useProxy = attempt % 2 === 0; // Alternate
        } else {
          useProxy = true; // Use proxy for later attempts
        }

        const axiosInstance = this.createAxiosInstance(useProxy);

        console.log(`🔄 Attempt ${attempt}/${maxRetries} - ${useProxy ? 'WITH' : 'WITHOUT'} proxy`);
        console.log(`📡 Requesting: ${url}`);

        // Add random delay between requests (but not on first attempt)
        if (attempt > 1) {
          const delay = Math.min(1000 + (attempt * 500), 5000); // Progressive delay
          console.log(`⏳ Waiting ${Math.round(delay)}ms...`);
          await this.sleep(delay);
        }

        const response = await axiosInstance.get(url, {
          ...config,
          headers: {
            ...this.createRealisticHeaders(),
            ...config?.headers
          }
        });

        console.log(`✅ Success! Status: ${response.status}, Content: ${response.data.length} chars`);

        // Check for common captcha/block indicators
        if (this.isBlocked(response.data)) {
          console.log(`⚠️ Response seems blocked, retrying...`);
          throw new Error('Request blocked or captcha detected');
        }

        return response;

      } catch (error: any) {
        lastError = error;

        console.log(`❌ Attempt ${attempt}/${maxRetries} failed: ${error.message}`);

        // Special handling for different error types
        if (error.code === 'ECONNABORTED') {
          console.log(`⏰ Timeout error - server too slow`);
        } else if (error.code === 'ECONNREFUSED') {
          console.log(`🔒 Connection refused - trying different approach`);
        } else if (error.code === 'ENOTFOUND') {
          console.log(`🌐 DNS error - network issue`);
        } else if (error.response?.status === 403) {
          console.log(`🚫 Forbidden - might be blocked`);
        } else if (error.response?.status === 429) {
          console.log(`⏱️ Rate limited - slowing down`);
          // Extra delay for rate limiting
          if (attempt < maxRetries) {
            await this.sleep(5000 + Math.random() * 5000);
          }
        }

        if (attempt < maxRetries) {
          console.log(`🔄 Retrying...`);
        }
      }
    }

    throw new Error(`❌ Failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  private isBlocked(html: string): boolean {
    const blockIndicators = [
      'captcha',
      'blocked',
      'access denied',
      'cloudflare',
      'please verify',
      'robot',
      'security check',
      'rate limit',
      'too many requests',
      'forbidden',
      'temporarily unavailable',
      'service unavailable'
    ];

    const lowerHtml = html.toLowerCase();
    const isBlocked = blockIndicators.some(indicator => lowerHtml.includes(indicator));

    if (isBlocked) {
      console.log(`🚫 Blocked content detected in response`);
    }

    return isBlocked;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to test connection without retries
  async testConnection(url: string, useProxy: boolean = true): Promise<any> {
    const axiosInstance = this.createAxiosInstance(useProxy);
    console.log(`🧪 Testing connection to: ${url} ${useProxy ? 'WITH' : 'WITHOUT'} proxy`);

    try {
      const response = await axiosInstance.get(url);
      console.log(`✅ Test successful: ${response.status}`);
      return response;
    } catch (error) {
      console.log(`❌ Test failed: ${error}`);
      throw error;
    }
  }
}

export default ProxyManager.getInstance();
