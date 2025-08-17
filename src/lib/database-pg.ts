import { Pool } from 'pg';

// PostgreSQL connection pool
let pool: Pool | null = null;

export function initDatabase() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is required');
    throw new Error('DATABASE_URL environment variable is required. Please set up your PostgreSQL database URL.');
  }

  console.log('🔗 Connecting to PostgreSQL database...');

  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Initialize database tables
  initTables();

  return pool;
}

async function initTables() {
  const client = await pool!.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        bestseller_url TEXT,
        last_crawled TIMESTAMPTZ,
        total_pages INTEGER DEFAULT 50,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        isbn TEXT,
        title TEXT NOT NULL,
        price DECIMAL(10,2),
        original_price DECIMAL(10,2),
        book_format TEXT,
        author TEXT,
        description TEXT,
        rating TEXT,
        category_id INTEGER,
        page_number INTEGER,
        rank_in_page INTEGER,
        product_url TEXT UNIQUE,
        in_stock BOOLEAN DEFAULT true,
        last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id)
      );

      CREATE TABLE IF NOT EXISTS crawl_sessions (
        id SERIAL PRIMARY KEY,
        session_name TEXT,
        status TEXT DEFAULT 'running',
        category_id INTEGER,
        total_products INTEGER DEFAULT 0,
        successful_products INTEGER DEFAULT 0,
        failed_products INTEGER DEFAULT 0,
        start_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMPTZ,
        FOREIGN KEY (category_id) REFERENCES categories (id)
      );

      CREATE TABLE IF NOT EXISTS product_links (
        id SERIAL PRIMARY KEY,
        url TEXT UNIQUE,
        category_id INTEGER,
        page_number INTEGER,
        rank_in_page INTEGER,
        crawled BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id)
      );

      CREATE TABLE IF NOT EXISTS error_logs (
        id SERIAL PRIMARY KEY,
        url TEXT,
        error_type TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        session_id INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES crawl_sessions (id)
      );

      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_isbn ON products(isbn);
      CREATE INDEX IF NOT EXISTS idx_product_links_category ON product_links(category_id);
      CREATE INDEX IF NOT EXISTS idx_product_links_crawled ON product_links(crawled);
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database tables:', error);
  } finally {
    client.release();
  }
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
      const client = await db.connect();
      try {
        const result = await client.query(
          'INSERT INTO categories (name, url, bestseller_url, status) VALUES ($1, $2, $3, $4) RETURNING *',
          [name, url, bestseller_url, status]
        );
        return result.rows[0];
      } finally {
        client.release();
      }
    }
  }),

  getAll: () => ({
    all: async () => {
      const db = initDatabase();
      const client = await db.connect();
      try {
        const result = await client.query('SELECT * FROM categories ORDER BY name');
        return result.rows;
      } finally {
        client.release();
      }
    }
  }),

  getById: () => ({
    get: async (id: number) => {
      const db = initDatabase();
      const client = await db.connect();
      try {
        const result = await client.query('SELECT * FROM categories WHERE id = $1', [id]);
        return result.rows[0];
      } finally {
        client.release();
      }
    }
  }),

  updateBestsellerUrl: () => ({
    run: async (bestseller_url: string, id: number) => {
      const db = initDatabase();
      const client = await db.connect();
      try {
        await client.query(
          'UPDATE categories SET bestseller_url = $1, status = $2 WHERE id = $3',
          [bestseller_url, 'ready', id]
        );
      } finally {
        client.release();
      }
    }
  }),

  updateLastCrawled: () => ({
    run: async (id: number) => {
      const db = initDatabase();
      const client = await db.connect();
      try {
        await client.query(
          'UPDATE categories SET last_crawled = CURRENT_TIMESTAMP WHERE id = $1',
          [id]
        );
      } finally {
        client.release();
      }
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
      const client = await db.connect();
      try {
        const result = await client.query(`
          INSERT INTO products
          (isbn, title, price, original_price, category_id, page_number, rank_in_page, product_url, in_stock, book_format, author, description, rating)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (product_url) DO UPDATE SET
            isbn = $1, title = $2, price = $3, original_price = $4, in_stock = $9,
            book_format = $10, author = $11, description = $12, rating = $13,
            last_updated = CURRENT_TIMESTAMP
          RETURNING *
        `, [isbn, title, price, original_price, category_id, page_number, rank_in_page, product_url, in_stock, book_format, author, description, rating]);
        return result.rows[0];
      } finally {
        client.release();
      }
    }
  }),

  getByCategory: () => ({
    all: async (category_id: number) => {
      const db = initDatabase();
      const client = await db.connect();
      try {
        const result = await client.query(
          'SELECT * FROM products WHERE category_id = $1 ORDER BY page_number, rank_in_page',
          [category_id]
        );
        return result.rows;
      } finally {
        client.release();
      }
    }
  }),

  search: () => ({
    all: async (search: string) => {
      const db = initDatabase();
      const client = await db.connect();
      try {
        const result = await client.query(`
          SELECT p.*, c.name as category_name
          FROM products p
          JOIN categories c ON p.category_id = c.id
          WHERE p.title ILIKE $1 OR p.isbn ILIKE $1
          ORDER BY p.created_at DESC
        `, [`%${search}%`]);
        return result.rows;
      } finally {
        client.release();
      }
    }
  }),

  getAll: () => ({
    all: async () => {
      const db = initDatabase();
      const client = await db.connect();
      try {
        const result = await client.query(`
          SELECT p.*, c.name as category_name
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          ORDER BY p.created_at DESC
        `);
        return result.rows;
      } finally {
        client.release();
      }
    }
  })
};

// Product links operations
export const productLinkService = {
  insertBatch: async (links: ProductLink[]) => {
    const db = initDatabase();
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      for (const link of links) {
        await client.query(`
          INSERT INTO product_links (url, category_id, page_number, rank_in_page)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (url) DO NOTHING
        `, [link.url, link.category_id, link.page_number, link.rank_in_page]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  getUncrawled: () => ({
    all: async (category_id: number) => {
      const db = initDatabase();
      const client = await db.connect();
      try {
        const result = await client.query(
          'SELECT * FROM product_links WHERE crawled = false AND category_id = $1 ORDER BY page_number, rank_in_page',
          [category_id]
        );
        return result.rows;
      } finally {
        client.release();
      }
    }
  }),

  markCrawled: () => ({
    run: async (url: string) => {
      const db = initDatabase();
      const client = await db.connect();
      try {
        await client.query('UPDATE product_links SET crawled = true WHERE url = $1', [url]);
      } finally {
        client.release();
      }
    }
  }),

  getAll: () => ({
    all: async () => {
      const db = initDatabase();
      const client = await db.connect();
      try {
        const result = await client.query(`
          SELECT pl.*, c.name as category_name
          FROM product_links pl
          LEFT JOIN categories c ON pl.category_id = c.id
          ORDER BY pl.created_at DESC
        `);
        return result.rows;
      } finally {
        client.release();
      }
    }
  })
};

// Session operations
export const sessionService = {
  create: () => ({
    run: async (session_name: string, category_id: number) => {
      const db = initDatabase();
      const client = await db.connect();
      try {
        const result = await client.query(
          'INSERT INTO crawl_sessions (session_name, category_id, status) VALUES ($1, $2, $3) RETURNING *',
          [session_name, category_id, 'running']
        );
        return result.rows[0];
      } finally {
        client.release();
      }
    }
  }),

  updateProgress: () => ({
    run: async (total_products: number, successful_products: number, failed_products: number, id: number) => {
      const db = initDatabase();
      const client = await db.connect();
      try {
        await client.query(
          'UPDATE crawl_sessions SET total_products = $1, successful_products = $2, failed_products = $3 WHERE id = $4',
          [total_products, successful_products, failed_products, id]
        );
      } finally {
        client.release();
      }
    }
  }),

  finish: () => ({
    run: async (id: number) => {
      const db = initDatabase();
      const client = await db.connect();
      try {
        await client.query(
          'UPDATE crawl_sessions SET status = $1, end_time = CURRENT_TIMESTAMP WHERE id = $2',
          ['completed', id]
        );
      } finally {
        client.release();
      }
    }
  })
};

export default initDatabase;
