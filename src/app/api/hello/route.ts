import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Barnes & Noble Scraper API is working!',
    status: 'success'
  });
}
