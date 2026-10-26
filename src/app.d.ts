declare global {
	namespace App {
		interface Locals {
			user: { id: string; email: string; budgetId: string; timezone: string } | null;
		}
	}
}
export {};
