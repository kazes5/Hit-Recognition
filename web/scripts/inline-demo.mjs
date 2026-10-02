// Turns the demo build (dist-demo/) into one self-contained page: hitster-demo.html.
// CSS and JS are inlined, and the document wrapper is dropped so the page can be
// published as an Artifact (which supplies its own <html>/<head>/<body>).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../dist-demo/', import.meta.url).pathname;
let html = readFileSync(join(dir, 'demo.html'), 'utf8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g, (_, file) => {
  return `<style>\n${readFileSync(join(dir, file), 'utf8')}\n</style>`;
});
html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, file) => {
  const js = readFileSync(join(dir, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `__SCRIPT__${Buffer.from(js).toString('base64')}__END__`;
});

const title = /<title>[\s\S]*?<\/title>/.exec(html)?.[0] ?? '<title>Hitster</title>';
const styles = [...html.matchAll(/<style>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const scripts = [...html.matchAll(/__SCRIPT__([A-Za-z0-9+/=]+)__END__/g)]
  .map((m) => `<script type="module">\n${Buffer.from(m[1], 'base64').toString('utf8')}\n</script>`)
  .join('\n');
const body = /<body[^>]*>([\s\S]*?)<\/body>/.exec(html)?.[1]?.replace(/__SCRIPT__[A-Za-z0-9+/=]+__END__/g, '') ?? '';

const out = `${title}\n<meta name="theme-color" content="#1a1d1f">\n${styles}\n${body.trim()}\n${scripts}\n`;
if (/(?:src|href)="\.\/assets\//.test(out)) throw new Error('A built asset was not inlined');
writeFileSync(join(dir, 'hitster-demo.html'), out);
console.log(`wrote dist-demo/hitster-demo.html (${(out.length / 1024).toFixed(0)} KB)`);
