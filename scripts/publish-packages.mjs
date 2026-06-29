#!/usr/bin/env node
/**
 * Publish @harnesskit/* packages to npm in dependency order.
 *
 * Usage:
 *   npm run publish:packages
 *   npm run publish:packages -- --dry-run
 *   npm run publish:packages -- --tag next
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tagArg = args.find((arg) => arg.startsWith('--tag='))?.slice('--tag='.length);

const packages = [
  '@harnesskit/protocol',
  '@harnesskit/core',
  '@harnesskit/harness',
  '@harnesskit/server',
  '@harnesskit/react',
];

const run = (command, commandArgs, cwd = root) => {
  const result = spawnSync(command, commandArgs, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

console.log('Building all packages...');
run('npm', ['run', 'build']);

for (const workspace of packages) {
  const publishArgs = ['publish', '-w', workspace, '--access', 'public'];
  if (dryRun) {
    publishArgs.push('--dry-run');
  }
  if (tagArg) {
    publishArgs.push('--tag', tagArg);
  }

  console.log(`\nPublishing ${workspace}${dryRun ? ' (dry-run)' : ''}...`);
  run('npm', publishArgs);
}

console.log('\nDone. Update skill-chat config/harness-deps.manifest.json registryVersion if needed.');
