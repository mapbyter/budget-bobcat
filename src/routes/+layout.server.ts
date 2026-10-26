import { catchUp } from '$lib/server/recurring';

export const load = async ({ locals }) => {
	if (locals.user) await catchUp(locals.user.budgetId);
	return { user: locals.user };
};
