import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_URL = process.env.QUOTA_API_URL ?? 'http://localhost:3000/api/v1';
const COOKIE_NAME = 'quotacore_api_key';

async function forward(request: Request, path: string[]) {
  const apiKey = (await cookies()).get(COOKIE_NAME)?.value;
  if (!apiKey)
    return NextResponse.json(
      { error: { code: 'unauthenticated', message: 'Sign in to continue.' } },
      { status: 401 },
    );
  const url = `${API_URL}/${path.join('/')}${new URL(request.url).search}`;
  const headers = new Headers(request.headers);
  headers.set('X-API-Key', apiKey);
  headers.delete('host');
  let response: Response;
  try {
    response = await fetch(url, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method)
        ? undefined
        : await request.arrayBuffer(),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'backend_unavailable',
          message: `Quota API is unavailable at ${API_URL}. Start the backend or set QUOTA_API_URL.`,
        },
      },
      { status: 502 },
    );
  }
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      'Content-Type':
        response.headers.get('content-type') ?? 'application/json',
    },
  });
}

type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: Request, context: Context) {
  return forward(request, (await context.params).path);
}
export async function POST(request: Request, context: Context) {
  return forward(request, (await context.params).path);
}
export async function PUT(request: Request, context: Context) {
  return forward(request, (await context.params).path);
}
