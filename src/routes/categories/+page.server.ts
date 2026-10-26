import { fail } from '@sveltejs/kit';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { categoryGroups as G, categories as C } from '$lib/server/db/schema';

const bid = (l: App.Locals) => l.user!.budgetId;
const cleanName = (v: FormDataEntryValue | null) => {
	const n = String(v ?? '').trim();
	return n.length >= 1 && n.length <= 60 ? n : null;
};
const parentMatch = (b: string, p: string | null) =>
	and(eq(G.budgetId, b), p ? eq(G.parentId, p) : isNull(G.parentId));

async function nextGroupOrder(b: string, p: string | null) {
	const [r] = await db.select({ o: G.sortOrder }).from(G).where(parentMatch(b, p)).orderBy(desc(G.sortOrder)).limit(1);
	return (r?.o ?? -1) + 1;
}
async function nextCatOrder(b: string, g: string) {
	const [r] = await db.select({ o: C.sortOrder }).from(C).where(and(eq(C.budgetId, b), eq(C.groupId, g))).orderBy(desc(C.sortOrder)).limit(1);
	return (r?.o ?? -1) + 1;
}
async function ownGroup(b: string, id: string | null) {
	if (!id) return null;
	const [g] = await db.select().from(G).where(and(eq(G.id, id), eq(G.budgetId, b)));
	return g ?? null;
}

export const load = async ({ locals }) => {
	const b = bid(locals);
	const [groups, cats] = await Promise.all([
		db.select().from(G).where(eq(G.budgetId, b)).orderBy(asc(G.sortOrder), asc(G.name)),
		db.select().from(C).where(eq(C.budgetId, b)).orderBy(asc(C.sortOrder), asc(C.name))
	]);
	return { groups, cats };
};

export const actions = {
	add: async ({ request, locals }) => {
		const b = bid(locals);
		const f = await request.formData();
		const name = cleanName(f.get('name'));
		const kind = String(f.get('kind'));
		const parentId = String(f.get('parentId') ?? '') || null;
		if (!name) return fail(400, { error: 'Enter a name (up to 60 characters).' });
		const parent = await ownGroup(b, parentId);
		if (parentId && !parent) return fail(400, { error: 'Group not found.' });
		if (kind === 'group') {
			await db.insert(G).values({ budgetId: b, name, parentId, sortOrder: await nextGroupOrder(b, parentId) });
		} else if ((kind === 'spending' || kind === 'savings') && parentId) {
			await db.insert(C).values({ budgetId: b, name, groupId: parentId, type: kind, sortOrder: await nextCatOrder(b, parentId) });
		} else return fail(400, { error: 'Categories must live inside a group.' });
	},

	rename: async ({ request, locals }) => {
		const b = bid(locals);
		const f = await request.formData();
		const name = cleanName(f.get('name'));
		const id = String(f.get('id'));
		if (!name) return fail(400, { error: 'Enter a name (up to 60 characters).' });
		if (f.get('kind') === 'group') await db.update(G).set({ name }).where(and(eq(G.id, id), eq(G.budgetId, b)));
		else await db.update(C).set({ name }).where(and(eq(C.id, id), eq(C.budgetId, b)));
	},

	move: async ({ request, locals }) => {
		const b = bid(locals);
		const f = await request.formData();
		const id = String(f.get('id'));
		const target = String(f.get('target') ?? '') || null;
		if (f.get('kind') === 'group') {
			const all = await db.select().from(G).where(eq(G.budgetId, b));
			// the new parent must not be the group itself or one of its descendants
			for (let cur = target; cur; cur = all.find((g) => g.id === cur)?.parentId ?? null) {
				if (cur === id) return fail(400, { error: 'A group cannot be moved inside itself.' });
			}
			if (target && !all.some((g) => g.id === target)) return fail(400, { error: 'Group not found.' });
			await db.update(G).set({ parentId: target, sortOrder: await nextGroupOrder(b, target) }).where(and(eq(G.id, id), eq(G.budgetId, b)));
		} else {
			if (!target || !(await ownGroup(b, target))) return fail(400, { error: 'Pick a group.' });
			await db.update(C).set({ groupId: target, sortOrder: await nextCatOrder(b, target) }).where(and(eq(C.id, id), eq(C.budgetId, b)));
		}
	},

	reorder: async ({ request, locals }) => {
		const b = bid(locals);
		const f = await request.formData();
		const id = String(f.get('id'));
		const delta = f.get('dir') === 'up' ? -1 : 1;
		if (f.get('kind') === 'group') {
			const g = await ownGroup(b, id);
			if (!g) return;
			const sibs = await db.select({ id: G.id }).from(G).where(parentMatch(b, g.parentId)).orderBy(asc(G.sortOrder), asc(G.name));
			const i = sibs.findIndex((s) => s.id === id), j = i + delta;
			if (j < 0 || j >= sibs.length) return;
			[sibs[i], sibs[j]] = [sibs[j], sibs[i]];
			await db.transaction(async (tx) => {
				for (const [n, s] of sibs.entries()) await tx.update(G).set({ sortOrder: n }).where(eq(G.id, s.id));
			});
		} else {
			const [c] = await db.select().from(C).where(and(eq(C.id, id), eq(C.budgetId, b)));
			if (!c) return;
			const sibs = await db.select({ id: C.id }).from(C).where(and(eq(C.budgetId, b), eq(C.groupId, c.groupId))).orderBy(asc(C.sortOrder), asc(C.name));
			const i = sibs.findIndex((s) => s.id === id), j = i + delta;
			if (j < 0 || j >= sibs.length) return;
			[sibs[i], sibs[j]] = [sibs[j], sibs[i]];
			await db.transaction(async (tx) => {
				for (const [n, s] of sibs.entries()) await tx.update(C).set({ sortOrder: n }).where(eq(C.id, s.id));
			});
		}
	},

	setFlag: async ({ request, locals }) => {
		const f = await request.formData();
		const field = String(f.get('field'));
		if (field !== 'archived' && field !== 'rollover') return fail(400, { error: 'Invalid request.' });
		await db.update(C).set({ [field]: f.get('value') === 'true' }).where(and(eq(C.id, String(f.get('id'))), eq(C.budgetId, bid(locals))));
	},

	deleteGroup: async ({ request, locals }) => {
		const b = bid(locals);
		const id = String((await request.formData()).get('id'));
		const [child] = await db.select({ id: G.id }).from(G).where(and(eq(G.parentId, id), eq(G.budgetId, b))).limit(1);
		const [cat] = await db.select({ id: C.id }).from(C).where(and(eq(C.groupId, id), eq(C.budgetId, b))).limit(1);
		if (child || cat) return fail(400, { error: 'Move or remove everything inside this group first.' });
		await db.delete(G).where(and(eq(G.id, id), eq(G.budgetId, b)));
	},

	seed: async ({ locals }) => {
		const b = bid(locals);
		const [existing] = await db.select({ id: G.id }).from(G).where(eq(G.budgetId, b)).limit(1);
		if (existing) return fail(400, { error: 'You already have groups.' });
		const grp = async (name: string, parentId: string | null, order: number) =>
			(await db.insert(G).values({ budgetId: b, name, parentId, sortOrder: order }).returning({ id: G.id }))[0].id;
		const cats = async (groupId: string, names: string[], type = 'spending') =>
			db.insert(C).values(names.map((name, i) => ({ budgetId: b, groupId, name, type, sortOrder: i })));
		const exp = await grp('Expenses', null, 0);
		await cats(exp, ['Rent/Mortgage', 'Utilities', 'Subscriptions', 'Groceries']);
		const ins = await grp('Insurance', exp, 0);
		await cats(ins, ['Car', 'Home', 'Motorcycle']);
		const sav = await grp('Savings & investments', null, 1);
		await cats(sav, ['Emergency fund', 'Travel savings'], 'savings');
	}
};
