import { NextRequest, NextResponse } from 'next/server';
import { isBuildMode, createBuildModeResponse, logBuildMode } from '@/lib/build-utils';

// Force this API route to be dynamic (not statically generated)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    // Early build mode check - before any imports
    if (isBuildMode()) {
      logBuildMode('categories');
      return NextResponse.json(createBuildModeResponse('Categories not available during build'));
    }

    // Lazy import heavy dependencies only in runtime
    const { categoryService } = await import('@/lib/database-supabase');

    const categories = await categoryService.getAll().all();
    return NextResponse.json({ success: true, data: categories });
  } catch (error: any) {
    console.error('❌ Error fetching categories:', error);

    // During build, return empty data instead of failing
    if (isBuildMode()) {
      logBuildMode('categories-error');
      return NextResponse.json(createBuildModeResponse('Categories error in build mode'));
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
