import { NextResponse } from 'next/server';
import { loadRules, saveRules } from '@/lib/storage';

export async function GET() {
  const rules = loadRules();
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  try {
    const { rules } = await request.json();
    if (!Array.isArray(rules)) {
      return NextResponse.json({ error: 'Rules must be an array' }, { status: 400 });
    }
    saveRules(rules);
    return NextResponse.json({ success: true, rules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
