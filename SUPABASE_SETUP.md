# 🚀 Supabase Setup Guide for Barnes & Noble Scraper

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or login to your account
3. Click "New Project"
4. Choose your organization
5. Fill in project details:
   - **Name**: `bn-scraper` (or any name you prefer)
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your location
6. Click "Create new project"
7. Wait for the project to be created (takes 1-2 minutes)

## Step 2: Get Your Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. You'll find:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Project API Keys**:
     - **anon/public key**: `eyJ...` (long string starting with eyJ)

## Step 3: Update Environment Variables

Update your `.env.local` file with your Supabase credentials:

```env
# Replace these with your actual Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 4: Create Database Tables

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy and paste the entire content from `supabase-schema.sql`
4. Click "Run" to execute the schema
5. Verify that tables are created in **Table Editor**

## Step 5: Test the Connection

1. Start your development server:
   ```bash
   cd bn-scraper
   bun dev
   ```

2. Open your app and check the logs
3. You should see: "✅ Supabase client initialized successfully"
4. Test by clicking "Test API Health" button

## Step 6: Deploy to Production

Once everything works locally:

1. Add your environment variables to Netlify:
   - Go to your Netlify site dashboard
   - Go to **Site settings** → **Environment variables**
   - Add:
     - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key

2. Deploy your site - it will now use Supabase in production!

## Benefits of Supabase vs SQLite

✅ **Works in serverless environments** (Netlify, Vercel)
✅ **Real-time capabilities** for live updates
✅ **Automatic backups** and point-in-time recovery
✅ **Built-in dashboard** to view your data
✅ **REST API** auto-generated
✅ **Scalable** - handles large amounts of data
✅ **Authentication** ready if needed later

## Troubleshooting

### Connection Issues
- Make sure your Supabase project is active (not paused)
- Double-check your environment variables
- Ensure you're using the correct anon key (not service role key)

### RLS Policies
- The schema includes public access policies
- In production, you might want to restrict access

### Performance
- Supabase has generous free tier limits
- Monitor usage in Supabase dashboard

## Data Migration

If you have existing SQLite data, you can export it as CSV and import into Supabase tables using the Table Editor interface.

---

**Next Step**: Update your `.env.local` file and run the schema, then test your connection!
