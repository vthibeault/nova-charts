// Renders the vitest JUnit results into a GitHub Actions job summary so the
// pass/fail breakdown shows up on the workflow run page (and, via the run's
// Checks, on the PR). Pure Node, no dependencies, no third-party actions.
import { readFileSync, appendFileSync } from 'node:fs';

const JUNIT = 'test-results/junit.xml';
const summaryFile = process.env.GITHUB_STEP_SUMMARY;

function attr(tag, name) {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : '';
}

let xml;
try {
  xml = readFileSync(JUNIT, 'utf8');
} catch {
  const msg = `### ⚠️ No test report found at \`${JUNIT}\`\n`;
  if (summaryFile) appendFileSync(summaryFile, msg);
  console.log(msg);
  process.exit(0);
}

// Per-suite rows.
const suites = [...xml.matchAll(/<testsuite\b[^>]*>/g)].map((m) => m[0]);
const rows = [];
let totalTests = 0;
let totalFail = 0;
let totalSkip = 0;
let totalTime = 0;
const failures = [];

for (const s of suites) {
  const name = attr(s, 'name');
  const tests = Number(attr(s, 'tests') || 0);
  const fail = Number(attr(s, 'failures') || 0) + Number(attr(s, 'errors') || 0);
  const skip = Number(attr(s, 'skipped') || 0);
  const time = Number(attr(s, 'time') || 0);
  if (!name) continue; // skip the outer <testsuites> wrapper
  totalTests += tests;
  totalFail += fail;
  totalSkip += skip;
  totalTime += time;
  const status = fail > 0 ? '❌' : '✅';
  rows.push(
    `| ${status} | \`${name}\` | ${tests} | ${fail} | ${skip} | ${time.toFixed(2)}s |`,
  );
}

// Collect failed test case names with their messages.
for (const m of xml.matchAll(/<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g)) {
  const head = m[1];
  const body = m[2];
  if (/<failure|<error/.test(body)) {
    const name = attr(`<x ${head}>`, 'name');
    const cls = attr(`<x ${head}>`, 'classname');
    const msgMatch = /<(?:failure|error)[^>]*message="([^"]*)"/.exec(body);
    const message = msgMatch ? msgMatch[1].replace(/&#10;|&#13;/g, ' ').slice(0, 200) : '';
    failures.push(`- **${cls} › ${name}** — ${message}`);
  }
}

const passed = totalTests - totalFail - totalSkip;
const headline =
  totalFail > 0
    ? `## ❌ Tests: ${totalFail} failed, ${passed} passed (${totalTests} total)`
    : `## ✅ Tests: ${passed} passed (${totalTests} total)`;

let out = `${headline}\n\n`;
out += `_${rows.length} suites · ${totalTime.toFixed(2)}s${totalSkip ? ` · ${totalSkip} skipped` : ''}_\n\n`;
out += `| | Suite | Tests | Failed | Skipped | Time |\n`;
out += `|---|---|--:|--:|--:|--:|\n`;
out += rows.join('\n') + '\n';
if (failures.length) {
  out += `\n### Failures\n\n${failures.join('\n')}\n`;
}

if (summaryFile) appendFileSync(summaryFile, out + '\n');
console.log(out);
