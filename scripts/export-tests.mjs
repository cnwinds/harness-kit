import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const skillChatRoot = path.resolve('D:/ai_projects/skill-chat');
const harnessRoot = path.resolve('D:/ai_projects/harness-kit');

const exports = [
  ['apps/server/src/modules/chat/openai-harness.test.ts', 'packages/harness/src/openai-harness.test.ts'],
  ['apps/server/src/modules/chat/chat-service.test.ts', 'packages/server/src/orchestrator/chat-orchestrator.test.ts'],
];

for (const [source, target] of exports) {
  const content = execSync(`git show HEAD:${source}`, {
    cwd: skillChatRoot,
    encoding: 'utf8',
  });
  fs.writeFileSync(path.join(harnessRoot, target), content, 'utf8');
  console.log('exported', target, content.length);
}
