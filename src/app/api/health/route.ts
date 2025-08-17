import { NextResponse } from 'next/server';
import { initDatabase } from '@/lib/database-supabase';

export async function GET() {
  try {
    // Test Supabase connection
    const db = initDatabase();

    return NextResponse.json({
      success: true,
      message: 'Barnes & Noble Scraper API is healthy!',
      database: 'Supabase connected',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
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
