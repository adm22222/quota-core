import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_URL = process.env.QUOTA_API_URL ?? 'http://localhost:3000/api/v1';
const COOKIE_NAME = 'quotacore_api_key';

type SessionRequest = {
  action: 'create' | 'login';
  name?: string;
  apiKey?: string;
};

async function upstream(path: string, init: RequestInit = {}, apiKey?: string) {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: {
          code: 'backend_unavailable',
          message: `Quota API is unavailable at ${API_URL}. Start the backend or set QUOTA_API_URL.`,
        },
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as SessionRequest;
  let apiKey = body.apiKey?.trim();
  let response: Response;

  if (body.action === 'create') {
    if (!body.name?.trim())
      return NextResponse.json(
        { message: 'Enter an account name.' },
        { status: 400 },
      );
    response = await upstream('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: body.name.trim() }),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        apiKey?: string;
        account?: unknown;
      };
      apiKey = data.apiKey;
      if (!apiKey)
        return NextResponse.json(
          { message: 'The service did not return an API key.' },
          { status: 502 },
        );
      const result = NextResponse.json({ account: data.account, apiKey });
      result.cookies.set(COOKIE_NAME, apiKey, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
      return result;
    }
    return NextResponse.json(
      await response
        .json()
        .catch(() => ({ message: 'Account creation failed.' })),
      { status: response.status },
    );
  }

  if (!apiKey)
    return NextResponse.json({ message: 'Enter an API key.' }, { status: 400 });
  response = await upstream('/account', {}, apiKey);
  const data = await response
    .json()
    .catch(() => ({ message: 'Unable to reach the service.' }));
  if (!response.ok) return NextResponse.json(data, { status: response.status });
  const result = NextResponse.json({ account: data.account });
  result.cookies.set(COOKIE_NAME, apiKey, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return result;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
  return response;
}

export async function GET() {
  const cookieStore = await cookies();
  const apiKey = cookieStore.get(COOKIE_NAME)?.value;
  if (!apiKey) return NextResponse.json({ authenticated: false });
  const upstreamResponse = await upstream('/account', {}, apiKey);
  if (!upstreamResponse.ok) return NextResponse.json({ authenticated: false });
  const data = (await upstreamResponse.json()) as { account?: unknown };
  return NextResponse.json({ authenticated: true, account: data.account });
}
