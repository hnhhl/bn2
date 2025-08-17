import { NextResponse } from 'next/server';
import { initDatabase } from '@/lib/database-supabase';
import { isBuildMode, logBuildMode } from '@/lib/build-utils';

export async function GET() {
  try {
    // Check for build mode
    if (isBuildMode()) {
      logBuildMode('health');
      return NextResponse.json({
        success: true,
        message: 'Barnes & Noble Scraper API is healthy (build mode)!',
        database: 'Build mode - no database connection',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        platform: process.platform,
        nodeVersion: process.version,
        buildMode: true
      });
    }

    // Test Supabase connection
    const db = initDatabase();

    return NextResponse.json({
      success: true,
      message: 'Barnes & Noble Scraper API is healthy!',
      database: 'Supabase connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      platform: process.platform,
      nodeVersion: process.version
    });
  } catch (error: any) {
    // In build mode, return success anyway
    if (isBuildMode()) {
      logBuildMode('health-error');
      return NextResponse.json({
        success: true,
        message: 'Barnes & Noble Scraper API is healthy (build mode with error)!',
        database: 'Build mode - database error handled',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        platform: process.platform,
        nodeVersion: process.version,
        buildMode: true,
        buildError: error.message
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        database: 'Connection failed'
      },
      { status: 500 }
    );
  }
}
