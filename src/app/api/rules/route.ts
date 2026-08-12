import { NextResponse } from 'next/server';
import { loadRules, saveRules } from '@/lib/storage';
import { validateOrigin } from '@/lib/security';

export async function GET() {
  const rules = await loadRules();
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const { rules } = await request.json();
    if (!Array.isArray(rules)) {
      return NextResponse.json({ error: 'Rules must be an array' }, { status: 400 });
    }
    await saveRules(rules);
    return NextResponse.json({ success: true, rules });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to save rules';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

