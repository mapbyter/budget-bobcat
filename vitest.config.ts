import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests: pure logic, no database or server needed. Run with `npm test`.
export default defineConfig({
	resolve: { alias: { '$env/dynamic/private': path.resolve('tests/stubs/env.ts'), $lib: path.resolve('src/lib') } },
	test: { include: ['tests/unit/**/*.test.ts'] }
});
