-- Barnes & Noble Scraper Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Categories table
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

-- Products table
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

-- Crawl sessions table
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

-- Product links table
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

-- Error logs table
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

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_isbn ON products(isbn);
CREATE INDEX IF NOT EXISTS idx_product_links_category ON product_links(category_id);
CREATE INDEX IF NOT EXISTS idx_product_links_crawled ON product_links(crawled);

-- Enable Row Level Security (RLS) for Supabase
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a scraper app)
-- In production, you might want more restrictive policies

CREATE POLICY "Allow public read access on categories" ON categories
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert on categories" ON categories
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on categories" ON categories
  FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on products" ON products
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert on products" ON products
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on products" ON products
  FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on crawl_sessions" ON crawl_sessions
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert on crawl_sessions" ON crawl_sessions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on crawl_sessions" ON crawl_sessions
  FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on product_links" ON product_links
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert on product_links" ON product_links
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on product_links" ON product_links
  FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on error_logs" ON error_logs
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert on error_logs" ON error_logs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on error_logs" ON error_logs
  FOR UPDATE USING (true);
