// 读自检报告，写成 UTF-8 摘要（避开 PowerShell 重定向的编码问题）
import { readFileSync, writeFileSync } from 'node:fs';
const r = JSON.parse(readFileSync(new URL('../selftest/report.json', import.meta.url), 'utf8'));
const out = [];
out.push(`passed ${r.passed}/${r.total}  at ${r.at}  gpu=${r.flags?.gpu}`);
for (const c of r.checks) out.push(`${c.ok ? 'PASS' : 'FAIL'} ${c.name} ${c.detail ?? ''}`);
out.push('displays ' + JSON.stringify(r.display));
out.push('cpu ' + JSON.stringify(r.cpuPercent));
for (const [k, m] of Object.entries(r.memoryMB)) out.push(`${k}: private=${m.private}MB workingSet=${m.workingSet}MB procs=${m.processes} ${JSON.stringify(m.byType)}`);
writeFileSync(new URL('../selftest/summary.txt', import.meta.url), out.join('\n') + '\n', 'utf8');
