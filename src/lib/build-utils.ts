// Build-time utility functions

export function isBuildMode(): boolean {
  // Multiple ways to detect build mode
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Check for missing or placeholder credentials
  const missingOrPlaceholder = (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl === 'placeholder' ||
    supabaseKey === 'placeholder' ||
    supabaseUrl === '' ||
    supabaseKey === ''
  );

  // Check for build environment indicators
  const isBuildEnv = (
    process.env.NODE_ENV === 'production' ||
    process.env.NETLIFY === 'true' ||
    process.env.VERCEL === '1' ||
    process.env.CI === 'true' ||
    process.env.BUILD_MODE === 'true' ||
    typeof window === 'undefined' // Server-side rendering
  );

  // If missing credentials AND in build environment, definitely build mode
  const definitelyBuildMode = missingOrPlaceholder && isBuildEnv;

  return definitelyBuildMode;
}

export function createBuildModeResponse(message: string = 'Build mode - database not available') {
  return {
    success: true,
    data: [],
    buildMode: true,
    message,
    timestamp: new Date().toISOString()
  };
}

export function logBuildMode(route: string) {
  console.log(`🏗️ [${route}] Build mode detected - returning safe response`);
  console.log(`🔍 [${route}] Environment check:`, {
    NODE_ENV: process.env.NODE_ENV,
    NETLIFY: process.env.NETLIFY,
    VERCEL: process.env.VERCEL,
    CI: process.env.CI,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    isServer: typeof window === 'undefined'
  });
}
