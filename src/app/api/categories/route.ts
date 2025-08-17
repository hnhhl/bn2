import { NextRequest, NextResponse } from 'next/server';
import { categoryService } from '@/lib/database-supabase';
import { isBuildMode, createBuildModeResponse, logBuildMode } from '@/lib/build-utils';

export async function GET() {
  try {
    // Check for build mode
    if (isBuildMode()) {
      logBuildMode('categories');
      return NextResponse.json(createBuildModeResponse('Categories not available during build'));
    }

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
