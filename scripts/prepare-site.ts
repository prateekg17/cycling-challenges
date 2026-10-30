import {copyFileSync, cpSync, mkdirSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const source = new URL('../static/', import.meta.url);
const output = new URL('../dist/site/', import.meta.url);

rmSync(output, {recursive: true, force: true});
mkdirSync(output, {recursive: true});
cpSync(source, output, {
    recursive: true,
    filter: path => !path.endsWith('.ts') && !path.endsWith('.js')
});
for (const filename of ['script.js', 'challenge-tile.js']) {
    copyFileSync(
        new URL(`../dist/frontend/${filename}`, import.meta.url),
        new URL(filename, output)
    );
}

console.log(`Built site: ${fileURLToPath(output)}`);
