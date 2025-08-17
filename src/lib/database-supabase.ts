import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase client
let supabase: SupabaseClient | null = null;

export function initDatabase() {
  if (supabase) return supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Handle build-time or missing credentials gracefully
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'placeholder' || supabaseKey === 'placeholder') {
    console.log('🏗️ Build mode or missing Supabase credentials - creating mock client');

    // Return a mock client that won't cause build failures
    const mockClient = {
      from: () => ({
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: null, error: null }),
        update: () => ({ data: null, error: null }),
        delete: () => ({ data: null, error: null }),
        upsert: () => ({ data: null, error: null })
      })
    };

    return mockClient as any;
  }

  console.log('🔗 Connecting to Supabase database...');

  supabase = createClient(supabaseUrl, supabaseKey);

  console.log('✅ Supabase client initialized successfully');

  return supabase;
}

export interface Category {
  id?: number;
  name: string;
  url: string;
  bestseller_url?: string;
  last_crawled?: string;
  total_pages?: number;
  status?: string;
  created_at?: string;
}

export interface Product {
  id?: number;
  isbn?: string;
  title: string;
  price?: number;
  original_price?: number;
  book_format?: string;
  author?: string;
  description?: string;
  rating?: string;
  category_id: number;
  page_number: number;
  rank_in_page: number;
  product_url: string;
  in_stock?: boolean;
  last_updated?: string;
  created_at?: string;
}

export interface ProductLink {
  id?: number;
  url: string;
  category_id: number;
  page_number: number;
  rank_in_page: number;
  crawled?: boolean;
  created_at?: string;
}

export interface CrawlSession {
  id?: number;
  session_name?: string;
  status?: string;
  category_id?: number;
  total_products?: number;
  successful_products?: number;
  failed_products?: number;
  start_time?: string;
  end_time?: string;
}

// Category operations
export const categoryService = {
  insert: () => ({
    run: async (name: string, url: string, bestseller_url: string | null, status: string) => {
      const db = initDatabase();
      const { data, error } = await db
        .from('categories')
        .insert({ name, url, bestseller_url, status })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }),

  getAll: () => ({
    all: async () => {
      const db = initDatabase();
      const { data, error } = await db
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    }
  }),

  getById: () => ({
    get: async (id: number) => {
      const db = initDatabase();
      const { data, error } = await db
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      return data;
    }
  }),

  updateBestsellerUrl: () => ({
    run: async (bestseller_url: string, id: number) => {
      const db = initDatabase();
      const { error } = await db
        .from('categories')
        .update({ bestseller_url, status: 'ready' })
        .eq('id', id);

      if (error) throw error;
    }
  }),

  updateLastCrawled: () => ({
    run: async (id: number) => {
      const db = initDatabase();
      const { error } = await db
        .from('categories')
        .update({ last_crawled: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    }
  })
};

// Product operations
export const productService = {
  insert: () => ({
    run: async (isbn: string | null, title: string, price: number | null, original_price: number | null,
               category_id: number, page_number: number, rank_in_page: number, product_url: string,
               in_stock: boolean, book_format?: string, author?: string, description?: string, rating?: string) => {
      const db = initDatabase();
      const { data, error } = await db
        .from('products')
        .upsert({
          isbn, title, price, original_price, category_id, page_number, rank_in_page,
          product_url, in_stock, book_format, author, description, rating,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'product_url',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }),

  getByCategory: () => ({
    all: async (category_id: number) => {
      const db = initDatabase();
      const { data, error } = await db
        .from('products')
        .select('*')
        .eq('category_id', category_id)
        .order('page_number')
        .order('rank_in_page');

      if (error) throw error;
      return data || [];
    }
  }),

  search: () => ({
    all: async (search: string) => {
      const db = initDatabase();
      const { data, error } = await db
        .from('products')
        .select(`
          *,
          categories!inner(name)
        `)
        .or(`title.ilike.%${search}%,isbn.ilike.%${search}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map to match the expected format
      return (data || []).map((item: any) => ({
        ...item,
        category_name: item.categories?.name
      }));
    }
  }),

  getAll: () => ({
    all: async () => {
      const db = initDatabase();
      const { data, error } = await db
        .from('products')
        .select(`
          *,
          categories(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map to match the expected format
      return (data || []).map((item: any) => ({
        ...item,
        category_name: item.categories?.name
      }));
    }
  })
};

// Product links operations
export const productLinkService = {
  insertBatch: async (links: ProductLink[]) => {
    const db = initDatabase();
    const { error } = await db
      .from('product_links')
      .upsert(
        links.map(link => ({
          url: link.url,
          category_id: link.category_id,
          page_number: link.page_number,
          rank_in_page: link.rank_in_page
        })),
        { onConflict: 'url', ignoreDuplicates: true }
      );

    if (error) throw error;
  },

  getUncrawled: () => ({
    all: async (category_id: number) => {
      const db = initDatabase();
      const { data, error } = await db
        .from('product_links')
        .select('*')
        .eq('crawled', false)
        .eq('category_id', category_id)
        .order('page_number')
        .order('rank_in_page');

      if (error) throw error;
      return data || [];
    }
  }),

  markCrawled: () => ({
    run: async (url: string) => {
      const db = initDatabase();
      const { error } = await db
        .from('product_links')
        .update({ crawled: true })
        .eq('url', url);

      if (error) throw error;
    }
  }),

  getAll: () => ({
    all: async () => {
      const db = initDatabase();
      const { data, error } = await db
        .from('product_links')
        .select(`
          *,
          categories(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map to match the expected format
      return (data || []).map((item: any) => ({
        ...item,
        category_name: item.categories?.name
      }));
    }
  })
};

// Session operations
export const sessionService = {
  create: () => ({
    run: async (session_name: string, category_id: number) => {
      const db = initDatabase();
      const { data, error } = await db
        .from('crawl_sessions')
        .insert({ session_name, category_id, status: 'running' })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }),

  updateProgress: () => ({
    run: async (total_products: number, successful_products: number, failed_products: number, id: number) => {
      const db = initDatabase();
      const { error } = await db
        .from('crawl_sessions')
        .update({ total_products, successful_products, failed_products })
        .eq('id', id);

      if (error) throw error;
    }
  }),

  finish: () => ({
    run: async (id: number) => {
      const db = initDatabase();
      const { error } = await db
        .from('crawl_sessions')
        .update({
          status: 'completed',
          end_time: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    }
  })
};

// Modern API functions
export async function getCategories(): Promise<Category[]> {
  return categoryService.getAll().all();
}

export async function getCategoryById(id: number): Promise<Category | null> {
  return categoryService.getById().get(id);
}

export async function createCategory(category: Omit<Category, 'id'>): Promise<Category> {
  return categoryService.insert().run(
    category.name,
    category.url,
    category.bestseller_url || null,
    category.status || 'new'
  );
}

export async function updateCategoryBestsellerUrl(id: number, bestsellerUrl: string): Promise<void> {
  return categoryService.updateBestsellerUrl().run(bestsellerUrl, id);
}

export async function updateCategoryStatus(id: number, status: string): Promise<void> {
  const db = initDatabase();
  const { error } = await db
    .from('categories')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}

export async function getProducts(filters: any = {}, pagination: { page?: number; limit?: number } = {}): Promise<any[]> {
  const db = initDatabase();
  const { page = 1, limit = 100 } = pagination;
  const offset = (page - 1) * limit;

  let query = db
    .from('products')
    .select(`
      *,
      categories(name)
    `);

  if (filters.category_id) {
    query = query.eq('category_id', filters.category_id);
  }

  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,isbn.ilike.%${filters.search}%`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  // Map to match the expected format
  return (data || []).map(item => ({
    ...item,
    category_name: item.categories?.name
  }));
}

export async function createProduct(product: Omit<Product, 'id'>): Promise<Product> {
  return productService.insert().run(
    product.isbn || null,
    product.title,
    product.price || null,
    product.original_price || null,
    product.category_id,
    product.page_number,
    product.rank_in_page,
    product.product_url,
    product.in_stock || false,
    product.book_format,
    product.author,
    product.description,
    product.rating
  );
}

export async function getProductLinks(filters: any = {}, pagination: { page?: number; limit?: number } = {}): Promise<any[]> {
  const db = initDatabase();
  const { page = 1, limit = 100 } = pagination;
  const offset = (page - 1) * limit;

  let query = db
    .from('product_links')
    .select(`
      *,
      categories(name)
    `);

  if (filters.category_id) {
    query = query.eq('category_id', filters.category_id);
  }

  if (typeof filters.crawled === 'boolean') {
    query = query.eq('crawled', filters.crawled);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  // Map to match the expected format
  return (data || []).map(item => ({
    ...item,
    category_name: item.categories?.name
  }));
}

export async function getProductLinksStats(categoryId?: number): Promise<any> {
  const db = initDatabase();

  // Get overall stats
  let totalQuery = db
    .from('product_links')
    .select('*', { count: 'exact', head: true });

  let crawledQuery = db
    .from('product_links')
    .select('*', { count: 'exact', head: true })
    .eq('crawled', true);

  if (categoryId) {
    totalQuery = totalQuery.eq('category_id', categoryId);
    crawledQuery = crawledQuery.eq('category_id', categoryId);
  }

  const [totalResult, crawledResult] = await Promise.all([
    totalQuery,
    crawledQuery
  ]);

  if (totalResult.error) throw totalResult.error;
  if (crawledResult.error) throw crawledResult.error;

  const total = totalResult.count || 0;
  const crawled = crawledResult.count || 0;
  const uncrawled = total - crawled;

  // Get stats by category
  const { data: byCategory, error: byCategoryError } = await db
    .from('product_links')
    .select(`
      category_id,
      crawled,
      categories(name)
    `);

  if (byCategoryError) throw byCategoryError;

  const categoryStats: any = {};

  for (const link of byCategory || []) {
    const catId = link.category_id;
    if (!categoryStats[catId]) {
      categoryStats[catId] = {
        category_name: (link.categories as any)?.name || `Category ${catId}`,
        total: 0,
        crawled: 0,
        uncrawled: 0
      };
    }
    categoryStats[catId].total++;
    if (link.crawled) {
      categoryStats[catId].crawled++;
    } else {
      categoryStats[catId].uncrawled++;
    }
  }

  return {
    total,
    crawled,
    uncrawled,
    byCategory: categoryStats
  };
}

export async function createProductLink(productLink: Omit<ProductLink, 'id'>): Promise<ProductLink> {
  const db = initDatabase();
  const { data, error } = await db
    .from('product_links')
    .upsert({
      url: productLink.url,
      category_id: productLink.category_id,
      page_number: productLink.page_number,
      rank_in_page: productLink.rank_in_page,
      crawled: productLink.crawled || false
    }, {
      onConflict: 'url',
      ignoreDuplicates: true
    })
    .select()
    .single();

  if (error && error.code !== '23505') throw error; // 23505 = unique violation (duplicate)
  return data;
}

export async function updateProductLink(id: number, updates: Partial<ProductLink>): Promise<void> {
  const db = initDatabase();
  const { error } = await db
    .from('product_links')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function getProductLinksCount(categoryId?: number): Promise<number> {
  const db = initDatabase();

  let query = db
    .from('product_links')
    .select('*', { count: 'exact', head: true });

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { count, error } = await query;

  if (error) throw error;
  return count || 0;
}

export default initDatabase;
