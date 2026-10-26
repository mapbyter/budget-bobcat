declare module 'vitest' {
	export interface ProvidedContext {
		dbUrls: { it: string; e2e: string };
	}
}
export {};
