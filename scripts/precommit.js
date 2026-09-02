#!/usr/bin/env node
// Pre-commit gate: запускает vitest + eslint. Если что-то падает — коммит блокируется.
// Использование: node scripts/precommit.js (или через .git/hooks/pre-commit)
import { spawnSync } from 'node:child_process';

const cyan = '\x1b[36m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const reset = '\x1b[0m';
const bold = '\x1b[1m';

function run(cmd, args, label) {
  console.log(`\n${cyan}${bold}▶ ${label}${reset}\n  $ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\n${red}${bold}✗ ${label} FAILED (exit ${r.status})${reset}`);
    process.exit(1);
  }
  console.log(`${green}✓ ${label} passed${reset}`);
}

console.log(`${bold}🛡  Inetometr pre-commit gate${reset}`);
run('npx', ['eslint', 'lib/', 'tests/'], 'ESLint');
run('npx', ['vitest', 'run'], 'Vitest unit tests');
console.log(`\n${green}${bold}✅ All checks passed — коммит разрешён${reset}\n`);
