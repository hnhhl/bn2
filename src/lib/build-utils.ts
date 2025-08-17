// Build-time utility functions

export function isBuildMode(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl === 'placeholder' ||
    supabaseKey === 'placeholder' ||
    process.env.NODE_ENV === 'production' && !process.env.NETLIFY_BUILD_HOOK_URL
  );
}

export function createBuildModeResponse(message: string = 'Build mode - database not available') {
  return {
    success: true,
    data: [],
    buildMode: true,
    message
  };
}

export function logBuildMode(route: string) {
  console.log(`🏗️ [${route}] Build mode detected - returning safe response`);
}
