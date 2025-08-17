# 🚀 Barnes & Noble Scraper - Deployment Instructions

## 📋 Setup Cloud Database (Supabase PostgreSQL)

### 1. Create Free Supabase Account
1. Go to **https://supabase.com**
2. Sign up with GitHub/Google (free tier: **2GB**, perfect for this project!)
3. Create new project: "bn-scraper"
4. Set a strong database password (save it!)
5. Wait 2-3 minutes for database setup

### 2. Get Database URL
1. In Supabase dashboard → **Settings** → **Database**
2. Scroll down to **Connection string** → **URI**
3. Copy connection string like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with your actual database password

### 3. Environment Variables
Set these in your deployment platform:

```bash
DATABASE_URL=postgresql://postgres:your-password@db.xxx.supabase.co:5432/postgres
```

## 🌐 Deploy Options

### Option 1: Netlify (Recommended)
1. Connect GitHub repository
2. Add environment variable `DATABASE_URL`
3. Deploy as dynamic site
4. Build command: `bun run build`
5. Publish directory: `.next`

### Option 2: Vercel
1. Connect GitHub repository
2. Add environment variable `DATABASE_URL`
3. Auto-deploy

### Option 3: Railway/Render
1. Connect GitHub repository
2. Add environment variable `DATABASE_URL`
3. Auto-deploy

## ✅ Features Ready
- ✅ Multi-threading scraping (20+ threads)
- ✅ Proxy rotation & retry logic
- ✅ Real-time progress tracking
- ✅ Categories → Bestsellers → Product Links → Products
- ✅ Export CSV/JSON
- ✅ Product Links management by category
- ✅ PostgreSQL cloud database
- ✅ Production-ready deployment

## 🎯 Usage After Deploy
1. Open deployed URL
2. Test API Health (green button)
3. Crawl Categories → Batch Bestsellers → Batch Links
4. View results in Product Links & Products tabs
5. Export data when needed

**Expected Performance**: 5,000+ product links in ~10 minutes with batch operations!
