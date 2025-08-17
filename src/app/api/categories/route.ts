import { NextRequest, NextResponse } from 'next/server';
import { categoryService } from '@/lib/database-supabase';

export async function GET() {
  try {
    // Check if we're in build mode or if Supabase credentials are missing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey || supabaseUrl === 'placeholder' || supabaseKey === 'placeholder') {
      console.log('🏗️ Build mode or missing Supabase credentials - returning empty categories');
      return NextResponse.json({
        success: true,
        data: [],
        buildMode: true
      });
    }

    const categories = await categoryService.getAll().all();
    return NextResponse.json({ success: true, data: categories });
  } catch (error: any) {
    console.error('❌ Error fetching categories:', error);

    // During build, return empty data instead of failing
    if (process.env.NODE_ENV === 'production' && !process.env.NETLIFY_BUILD_HOOK_URL) {
      console.log('🏗️ Build mode - returning empty categories to prevent build failure');
      return NextResponse.json({
        success: true,
        data: [],
        buildMode: true,
        error: 'Database not available during build'
      });
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
