import { NextRequest, NextResponse } from 'next/server';

type Handler = (
  req: NextRequest,
  ctx: { params: Record<string, string> },
) => Promise<NextResponse>;

export function handler(
  fn: Handler,
): (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> | Record<string, string> },
) => Promise<NextResponse> {
  return async (req, ctx) => {
    try {
      const params = await Promise.resolve(ctx.params);
      return await fn(req, { params });
    } catch (err: unknown) {
      if (err instanceof NextResponse) return err;
      if (err instanceof Error && 'status' in err) {
        const status = (err as Error & { status: number }).status;
        return NextResponse.json({ error: err.message, status }, { status });
      }
      console.error('API error:', err);
      return NextResponse.json(
        { error: 'Internal server error', status: 500 },
        { status: 500 },
      );
    }
  };
}
