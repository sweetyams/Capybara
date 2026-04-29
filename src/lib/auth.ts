import { auth } from '@clerk/nextjs/server';

export interface Session {
  userId: string;
}

function throwAuth(message: string, status: number): never {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  throw err;
}

export async function getSession(): Promise<Session | null> {
  const { userId } = await auth();
  if (!userId) return null;
  return { userId };
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session) throwAuth('Unauthorized', 401);
  return session;
}
