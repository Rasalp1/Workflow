import { NextResponse } from 'next/server';
import { loadConfig, saveConfig } from '@/lib/storage';
import { validateOrigin } from '@/lib/security';

export async function GET() {
  const config = await loadConfig();
  const rawToken = config.githubToken || '';
  const maskedToken = rawToken
    ? `${rawToken.substring(0, 4)}...${rawToken.substring(Math.max(0, rawToken.length - 4))}`
    : '';

  // Omit raw githubToken from client GET response for security
  const safeConfig = {
    ...config,
    githubToken: '',
    hasToken: Boolean(rawToken),
    maskedToken,
  };

  return NextResponse.json({ config: safeConfig });
}

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const newConfig = await request.json();
    const currentConfig = await loadConfig();

    const merged = {
      ...currentConfig,
      ...newConfig,
      // Keep existing token if masked or empty in input
      githubToken:
        newConfig.githubToken && !newConfig.githubToken.includes('...')
          ? newConfig.githubToken
          : currentConfig.githubToken,
    };

    await saveConfig(merged);

    const safeConfig = {
      ...merged,
      githubToken: '',
      hasToken: Boolean(merged.githubToken),
      maskedToken: merged.githubToken
        ? `${merged.githubToken.substring(0, 4)}...${merged.githubToken.substring(Math.max(0, merged.githubToken.length - 4))}`
        : '',
    };

    return NextResponse.json({ success: true, config: safeConfig });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

