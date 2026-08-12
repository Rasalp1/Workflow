import { NextResponse } from 'next/server';
import { loadConfig, saveConfig } from '@/lib/storage';

export async function GET() {
  const config = loadConfig();
  // Mask sensitive GitHub Token partially for display
  const maskedToken = config.githubToken
    ? `${config.githubToken.substring(0, 4)}...${config.githubToken.substring(config.githubToken.length - 4)}`
    : '';
  return NextResponse.json({ config: { ...config, maskedToken } });
}

export async function POST(request: Request) {
  try {
    const newConfig = await request.json();
    const currentConfig = loadConfig();

    const merged = {
      ...currentConfig,
      ...newConfig,
      // Keep existing token if masked or unchanged
      githubToken:
        newConfig.githubToken && !newConfig.githubToken.includes('...')
          ? newConfig.githubToken
          : currentConfig.githubToken,
    };

    saveConfig(merged);
    return NextResponse.json({ success: true, config: merged });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
