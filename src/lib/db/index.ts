import { neon } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let _db: NeonHttpDatabase<typeof schema> | null = null;

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    if (!_db) {
      const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      if (!url) throw new Error('DATABASE_URL or POSTGRES_URL must be set');
      _db = drizzle(neon(url), { schema });
    }
    return (_db as any)[prop];
  },
});
