type Group = { id: string; parentId: string | null; name: string };
type Cat = { id: string; groupId: string; name: string; archived: boolean };

/** Categories in tree order, labelled with their full group path, e.g. "Expenses › Insurance › Car". */
export function categoryOptions(groups: Group[], cats: Cat[], includeArchived = false) {
	const out: { id: string; label: string }[] = [];
	const walk = (pid: string | null, path: string[]) => {
		for (const g of groups.filter((g) => g.parentId === pid)) {
			const p = [...path, g.name];
			for (const c of cats.filter((c) => c.groupId === g.id && (includeArchived || !c.archived)))
				out.push({ id: c.id, label: [...p, c.name].join(' › ') });
			walk(g.id, p);
		}
	};
	walk(null, []);
	return out;
}
