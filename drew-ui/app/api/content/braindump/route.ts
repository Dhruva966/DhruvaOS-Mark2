import { NextRequest, NextResponse } from 'next/server';

interface BraindumpRequest {
  title: string;
  raw_content: string;
  tags?: string[];
}

export async function POST(request: NextRequest) {
  let body: BraindumpRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, raw_content, tags = [] } = body;
  if (!title?.trim() || !raw_content?.trim()) {
    return NextResponse.json({ error: 'title and raw_content required' }, { status: 400 });
  }

  const xposterUrl = process.env.XPOSTEROS_API_URL;
  const xposterToken = process.env.XPOSTEROS_API_TOKEN;

  if (!xposterUrl || !xposterToken) {
    return NextResponse.json(
      { error: 'XPOSTEROS_API_URL or XPOSTEROS_API_TOKEN not configured', offline: true },
      { status: 503 }
    );
  }

  let response: Response;
  try {
    response = await fetch(`${xposterUrl}/events/brain-dump`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${xposterToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, raw_content, source_url: null, tags }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `XPosterOS unreachable: ${err}`, offline: true },
      { status: 503 }
    );
  }

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    return NextResponse.json({ error: `XPosterOS: ${err}` }, { status: 502 });
  }

  const data = await response.json().catch(() => ({}));
  return NextResponse.json({ ok: true, data });
}
