import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Database + end-to-end tests. Needs Postgres: either set TEST_DATABASE_URL (an admin URL such as
// postgres://postgres:pw@localhost:5432/postgres) or `npm install --no-save embedded-postgres` to use a throwaway one.
export default defineConfig({
	resolve: { alias: { '$env/dynamic/private': path.resolve('tests/stubs/env.ts'), $lib: path.resolve('src/lib') } },
	test: {
		include: ['tests/integration/**/*.test.ts', 'tests/e2e/**/*.test.ts'],
		globalSetup: ['tests/global-setup.ts'],
		fileParallelism: false,
		testTimeout: 60_000,
		hookTimeout: 180_000
	}
});
