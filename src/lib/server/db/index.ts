import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

// Connects lazily, so building the image does not need a database.
const client = postgres(env.DATABASE_URL ?? '', { max: 10 });
export const db = drizzle(client, { schema });
export { schema };
