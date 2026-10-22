// House text rule: no em dash (U+2014) anywhere in the repo; write a plain hyphen instead.
// Runs as part of `npm run lint` over every tracked or new, non-ignored file.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EM_DASH = '\u2014';

export interface TextFinding {
  line: number;
  column: number;
}

export function findEmDashes(text: string): TextFinding[] {
  const findings: TextFinding[] = [];
  text.split('\n').forEach((content, index) => {
    let column = content.indexOf(EM_DASH);
    while (column !== -1) {
      findings.push({ line: index + 1, column: column + 1 });
      column = content.indexOf(EM_DASH, column + 1);
    }
  });
  return findings;
}

function repoFiles(): string[] {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8' },
  );
  return output.split('\0').filter((file) => file !== '');
}

function main(): void {
  let failures = 0;
  for (const file of repoFiles()) {
    let buffer: Buffer;
    try {
      buffer = readFileSync(file);
    } catch {
      continue; // deleted in the working tree but still tracked
    }
    if (buffer.includes(0)) {
      continue; // binary
    }
    for (const { line, column } of findEmDashes(buffer.toString('utf8'))) {
      console.error(`${file}:${String(line)}:${String(column)} em dash; use a plain hyphen "-"`);
      failures += 1;
    }
  }
  if (failures > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main();
}
