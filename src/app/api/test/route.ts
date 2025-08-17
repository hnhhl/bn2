import { NextRequest, NextResponse } from 'next/server';
import { ProxyManager } from '@/lib/proxy-manager';
import axios from 'axios';

export const GET = async () => {
  return new Response(
    JSON.stringify({ success: false, disabled: true, message: 'Test API disabled in production build.' }),
    { headers: { 'Content-Type': 'application/json' }, status: 200 }
  );
};
