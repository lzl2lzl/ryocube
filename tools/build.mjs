import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async name => (await readFile(new URL(name, root), 'utf8')).replace(/\r\n/g, '\n');
let html = await read('index.html');
html = html.replace('<link rel="stylesheet" href="style.css">', `<style>\n${await read('style.css')}\n</style>`);

for (const match of [...html.matchAll(/<script src="([a-z-]+\.js)"><\/script>/g)]) {
  const source = await read(match[1]);
  html = html.replace(match[0], () => `<script>\n${source}\n</script>`);
}

if (/<script src=|<link rel="stylesheet"/.test(html)) {
  throw new Error('构建尚有未打包的脚本或样式。');
}

await mkdir(new URL('publish/', root), { recursive: true });
await writeFile(new URL('publish/index.html', root), html, 'utf8');
await writeFile(new URL('publish/guide.html', root), await read('guide.html'), 'utf8');
await copyFile(new URL('manifest.webmanifest', root), new URL('publish/manifest.webmanifest', root));
await mkdir(new URL('publish/icons/', root), { recursive: true });
await copyFile(new URL('icons/app-icon.png', root), new URL('publish/icons/app-icon.png', root));
console.log('已生成房间、使用指南和主屏幕应用资源。');
