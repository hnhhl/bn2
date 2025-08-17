import { ProxyManager } from './proxy-manager';
import { BarnesNobleScraper } from './scraper';
import {
  updateCategoryBestsellerUrl,
  createProductLink,
  updateCategoryStatus,
  getProductLinksCount
} from './database-supabase';

interface Category {
  id?: number;
  name: string;
  url: string;
  bestseller_url?: string;
  status?: string;
}

interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  current: string;
  details: any;
}

interface Semaphore {
  acquire(): Promise<() => void>;
}

// Global detailed log buffer for batch operations
const LOG_BUFFER_SIZE = 1000;
let batchLogBuffer: string[] = [];

export function pushBatchLog(message: string, workerId?: number) {
  const ts = new Date().toISOString();
  const workerPrefix = workerId ? `[WORKER ${workerId}] ` : '';
  const line = `[${ts}] ${workerPrefix}${message}`;
  batchLogBuffer.push(line);
  if (batchLogBuffer.length > LOG_BUFFER_SIZE) {
    batchLogBuffer = batchLogBuffer.slice(-LOG_BUFFER_SIZE);
  }
  // Also mirror to server console for debugging
  console.log(line);
}

export function getBatchLogs(): string[] {
  return batchLogBuffer.slice(-300); // Return last 300 lines for UI
}

export function clearBatchLogs(): void {
  batchLogBuffer = [];
}

// Global progress tracking
let globalProgress: BatchProgress = {
  total: 0,
  completed: 0,
  failed: 0,
  current: '',
  details: {}
};

let isRunning = false;

export function getCrawlProgress(): BatchProgress {
  return { ...globalProgress };
}

export async function stopCrawling(): Promise<void> {
  isRunning = false;
  pushBatchLog('⏹️ Batch operation stopped by user');
}

export function resetBatchStats(): void {
  globalProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    current: '',
    details: {}
  };
  clearBatchLogs();
}

// Simple semaphore implementation
function createSemaphore(limit: number): Semaphore {
  let running = 0;
  const queue: (() => void)[] = [];

  return {
    async acquire(): Promise<() => void> {
      return new Promise((resolve) => {
        const tryAcquire = () => {
          if (running < limit) {
            running++;
            resolve(() => {
              running--;
              if (queue.length > 0) {
                const next = queue.shift();
                if (next) next();
              }
            });
          } else {
            queue.push(tryAcquire);
          }
        };
        tryAcquire();
      });
    }
  };
}

export class BatchProcessor {
  private proxyManager: ProxyManager;
  private scraper: BarnesNobleScraper;
  public isRunning: boolean = false;

  constructor() {
    this.proxyManager = new ProxyManager();
    this.scraper = new BarnesNobleScraper(this.proxyManager);
  }

  async startBatchBestsellers(categories: Category[], options: {
    threads?: number;
    forceRecrawl?: boolean;
  } = {}) {
    this.isRunning = true;
    isRunning = true;
    const { threads = 20, forceRecrawl = false } = options;

    clearBatchLogs();
    pushBatchLog(`🚀 Starting batch bestseller finding for ${categories.length} categories with ${threads} threads`);

    resetBatchStats();
    globalProgress.total = categories.length;

    const semaphore = createSemaphore(threads);

    const promises = categories.map((category, index) =>
      this.processCategoryBestsellers(category, semaphore, forceRecrawl, index + 1)
    );

    try {
      await Promise.all(promises);
      pushBatchLog(`🏁 Batch bestseller operation completed! ${globalProgress.completed} successful, ${globalProgress.failed} failed`);
    } catch (error) {
      pushBatchLog(`💥 Batch bestseller operation failed: ${error}`);
    } finally {
      this.isRunning = false;
      isRunning = false;
    }
  }

  async startBatchLinks(categories: Category[], options: {
    threads?: number;
    startPage?: number;
    endPage?: number;
  } = {}) {
    this.isRunning = true;
    isRunning = true;
    const { threads = 20, startPage = 1, endPage = 5 } = options;

    clearBatchLogs();
    pushBatchLog(`🚀 Starting batch links crawling for ${categories.length} categories`);
    pushBatchLog(`⚙️ Configuration: ${threads} threads, pages ${startPage}-${endPage}`);

    resetBatchStats();
    globalProgress.total = categories.length;

    const semaphore = createSemaphore(threads);

    const promises = categories.map((category, index) =>
      this.processCategoryLinks(category, semaphore, startPage, endPage, index + 1)
    );

    try {
      await Promise.all(promises);
      pushBatchLog(`🏁 Batch links operation completed! ${globalProgress.completed} successful, ${globalProgress.failed} failed`);
    } catch (error) {
      pushBatchLog(`💥 Batch links operation failed: ${error}`);
    } finally {
      this.isRunning = false;
      isRunning = false;
    }
  }

  private async processCategoryBestsellers(
    category: Category,
    semaphore: Semaphore,
    forceRecrawl: boolean,
    categoryIndex: number
  ): Promise<void> {
    pushBatchLog(`🔄 Acquiring semaphore for ${category.name}...`, categoryIndex);
    const release = await semaphore.acquire();
    pushBatchLog(`✅ Semaphore acquired! Starting bestseller search for ${category.name}`, categoryIndex);

    try {
      if (!isRunning) {
        pushBatchLog(`⏹️ Stopping - batch operation cancelled`, categoryIndex);
        return;
      }

      globalProgress.current = `[${categoryIndex}/${globalProgress.total}] Finding bestseller: ${category.name}`;

      if (category.bestseller_url && !forceRecrawl) {
        pushBatchLog(`⏭️ Skipping ${category.name} - already has bestseller URL`, categoryIndex);
        globalProgress.completed++;
        return;
      }

      pushBatchLog(`🔍 Searching for bestseller URL in: ${category.url}`, categoryIndex);
      const bestsellerUrl = await this.scraper.findBestsellerUrl(category.url);

      if (bestsellerUrl && category.id) {
        await updateCategoryBestsellerUrl(category.id, bestsellerUrl);
        await updateCategoryStatus(category.id, 'ready');
        pushBatchLog(`✅ Found bestseller for ${category.name}: ${bestsellerUrl}`, categoryIndex);
        globalProgress.completed++;
      } else {
        if (category.id) {
          await updateCategoryStatus(category.id, 'error');
        }
        pushBatchLog(`❌ No bestseller found for ${category.name}`, categoryIndex);
        globalProgress.failed++;
      }
    } catch (error: any) {
      pushBatchLog(`❌ Error finding bestseller for ${category.name}: ${error?.message || error}`, categoryIndex);
      if (category.id) {
        await updateCategoryStatus(category.id, 'error');
      }
      globalProgress.failed++;
    } finally {
      pushBatchLog(`🔓 Releasing semaphore for ${category.name}`, categoryIndex);
      release();
    }
  }

  private async processCategoryLinks(
    category: Category,
    semaphore: Semaphore,
    startPage: number,
    endPage: number,
    categoryIndex?: number
  ): Promise<void> {
    pushBatchLog(`🔄 Acquiring semaphore for ${category.name}...`, categoryIndex);
    const release = await semaphore.acquire();
    pushBatchLog(`✅ Semaphore acquired! Starting work on ${category.name}`, categoryIndex);

    try {
      if (!isRunning) {
        pushBatchLog(`⏹️ Stopping - batch operation cancelled`, categoryIndex);
        return;
      }

      if (!category.bestseller_url) {
        pushBatchLog(`❌ Skipping ${category.name} - no bestseller URL`, categoryIndex);
        globalProgress.failed++;
        return;
      }

      globalProgress.current = `[${categoryIndex}/${globalProgress.total}] Crawling links for: ${category.name}`;
      pushBatchLog(`🔗 Starting ${category.name} (pages ${startPage}-${endPage})`, categoryIndex);
      pushBatchLog(`📍 Bestseller URL: ${category.bestseller_url}`, categoryIndex);

      if (category.id) {
        await updateCategoryStatus(category.id, 'crawling_links');
      }

      let totalLinks = 0;
      let totalDuplicates = 0;
      for (let page = startPage; page <= endPage; page++) {
        if (!isRunning) {
          pushBatchLog(`⏹️ Stopping at page ${page} - batch cancelled`, categoryIndex);
          break;
        }

        try {
          const pageUrl = `${category.bestseller_url}?Nrpp=20&page=${page}`;
          pushBatchLog(`📄 ${category.name} - Page ${page}/${endPage}: ${pageUrl}`, categoryIndex);

          const startTime = Date.now();
          const links = await this.scraper.extractProductLinks(pageUrl);
          const endTime = Date.now();

          pushBatchLog(`📊 ${category.name} - Page ${page}: Found ${links.length} links in ${endTime - startTime}ms`, categoryIndex);

          let savedOnPage = 0;
          let duplicatesOnPage = 0;
          for (let i = 0; i < links.length; i++) {
            if (!isRunning) break;

            const link = links[i];
            if (category.id) {
              try {
                await createProductLink({
                  url: link.url,
                  category_id: category.id,
                  page_number: page,
                  rank_in_page: i + 1
                });
                totalLinks++;
                savedOnPage++;
              } catch (linkError) {
                // Link might already exist, that's ok
                duplicatesOnPage++;
                totalDuplicates++;
                if (duplicatesOnPage <= 3) { // Only log first few duplicates
                  pushBatchLog(`⚠️ Duplicate link (normal): ${link.url.substring(0, 80)}...`, categoryIndex);
                }
              }
            }
          }

          pushBatchLog(`✅ ${category.name} - Page ${page}: Saved ${savedOnPage} links, ${duplicatesOnPage} duplicates (total saved: ${totalLinks})`, categoryIndex);

          // Small delay between pages
          await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
        } catch (pageError: any) {
          pushBatchLog(`❌ ${category.name} - Page ${page} failed: ${pageError?.message || pageError}`, categoryIndex);
          // Continue with next page
        }
      }

      if (category.id) {
        await updateCategoryStatus(category.id, 'completed');
      }
      pushBatchLog(`🎉 COMPLETED ${category.name}: ${totalLinks} total links saved (${totalDuplicates} duplicates)`, categoryIndex);
      globalProgress.completed++;
      pushBatchLog(`📈 Progress: ${globalProgress.completed}/${globalProgress.total} categories completed`, categoryIndex);
    } catch (error: any) {
      pushBatchLog(`💥 FATAL ERROR for ${category.name}: ${error?.message || error}`, categoryIndex);
      if (category.id) {
        await updateCategoryStatus(category.id, 'error');
      }
      globalProgress.failed++;
      pushBatchLog(`📈 Progress: ${globalProgress.completed}/${globalProgress.total} completed, ${globalProgress.failed} failed`, categoryIndex);
    } finally {
      pushBatchLog(`🔓 Releasing semaphore for ${category.name}`, categoryIndex);
      release();
    }
  }
}
