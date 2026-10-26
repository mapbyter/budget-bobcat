import { sql } from 'drizzle-orm';
import { transactions as T } from './db/schema';

/** SQL: a transaction's signed effect in cents (expenses and withdrawals negative). Sum it for net activity. */
export const signedCents = sql`case when ${T.type} in ('expense','savings_withdrawal') then -${T.amountCents} else ${T.amountCents} end`;
