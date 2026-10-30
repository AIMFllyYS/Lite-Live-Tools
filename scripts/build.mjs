// 单脚本构建：main/preload 打成 CJS，renderer 每个页面一个 IIFE bundle，HTML/CSS 原样复制。
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const prod = process.argv.includes('--prod');
const out = join(root, 'dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const common = {
  bundle: true,
  minify: prod,
  sourcemap: prod ? false : 'inline',
  legalComments: 'none',
  logLevel: 'warning',
  define: { 'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development') },
};

await Promise.all([
  build({ ...common, platform: 'node', format: 'cjs', target: 'node22', external: ['electron'],
    entryPoints: { main: join(root, 'src/main/index.ts') }, outdir: out }),
  build({ ...common, platform: 'browser', format: 'cjs', target: 'chrome140', external: ['electron'],
    entryPoints: { preload: join(root, 'src/preload/preload.ts') }, outdir: out }),
  build({ ...common, platform: 'browser', format: 'iife', target: 'chrome140',
    entryPoints: {
      'menu/menu': join(root, 'src/renderer/menu/menu.ts'),
      'board/board': join(root, 'src/renderer/board/board.ts'),
      'fx/fx': join(root, 'src/renderer/fx/fx.ts'),
      'agent/agent': join(root, 'src/renderer/agent/agent.ts'),
    }, outdir: join(out, 'renderer') }),
]);

// 复制静态文件（html/css/svg）
function copyStatic(src, dst) {
  for (const name of readdirSync(src)) {
    const s = join(src, name), d = join(dst, name);
    if (statSync(s).isDirectory()) { mkdirSync(d, { recursive: true }); copyStatic(s, d); }
    else if (/\.(html|css|svg|png)$/.test(name)) cpSync(s, d);
  }
}
mkdirSync(join(out, 'renderer'), { recursive: true });
copyStatic(join(root, 'src/renderer'), join(out, 'renderer'));
console.log(`build ok (${prod ? 'prod' : 'dev'})`);
