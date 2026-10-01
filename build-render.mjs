import { mkdir, copyFile, writeFile } from 'node:fs/promises';

const backend = process.env.API_BASE_URL;
if (!backend) throw new Error('API_BASE_URL must be the public backend HTTPS origin.');
const url = new URL(backend);
if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
  throw new Error('API_BASE_URL must be an HTTPS origin without a path, credentials, query, or fragment.');
}
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'favicon.svg']) {
  await copyFile(file, `dist/${file}`);
}
await writeFile('dist/config.js', `window.CALCULATOR_CONFIG = Object.freeze(${JSON.stringify({apiBaseUrl: url.origin})});\n`);
console.log(`Frontend built for ${url.origin}`);
