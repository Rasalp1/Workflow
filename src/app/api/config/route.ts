import { NextResponse } from 'next/server';
import { loadConfig, saveConfig } from '@/lib/storage';
import { validateLocalPath, validateOrigin } from '@/lib/security';
import { clearGitHubCache } from '@/lib/github';

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
    if (!newConfig || typeof newConfig !== 'object' || Array.isArray(newConfig)) {
      return NextResponse.json({ error: 'Configuration must be a JSON object.' }, { status: 400 });
    }

    const requestedRepoPaths = (newConfig as { repoPaths?: unknown }).repoPaths;
    if (requestedRepoPaths !== undefined) {
      if (!requestedRepoPaths || typeof requestedRepoPaths !== 'object' || Array.isArray(requestedRepoPaths)) {
        return NextResponse.json({ error: 'repoPaths must be an object.' }, { status: 400 });
      }
      for (const [repo, localPath] of Object.entries(requestedRepoPaths)) {
        if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
          return NextResponse.json({ error: `Invalid repository name "${repo}".` }, { status: 400 });
        }
        if (localPath === '') continue;
        if (typeof localPath !== 'string') {
          return NextResponse.json({ error: `Path for "${repo}" must be a string.` }, { status: 400 });
        }
        validateLocalPath(localPath);
      }
    }
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
    clearGitHubCache();

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
