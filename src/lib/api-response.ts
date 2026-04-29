import { NextResponse } from 'next/server';

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error, status }, { status });
}

export function jsonList<T>(data: T[], meta: { total: number; limit: number; offset: number }) {
  return NextResponse.json({ data, meta });
}
