import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {expect, it} from 'vitest';

it('builds the site without placing generated modules beside TypeScript sources', () => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const source = new URL('../static/', import.meta.url);
    const output = new URL('../dist/site/', import.meta.url);
    const sourceFiles = readdirSync(source);

    execFileSync('npm', ['run', 'build:frontend'], {cwd: root, stdio: 'pipe'});

    expect(readdirSync(source)).toEqual(sourceFiles);
    expect(existsSync(new URL('script.js', source))).toBe(false);
    expect(existsSync(new URL('challenge-tile.js', source))).toBe(false);
    for (const filename of ['script.js', 'challenge-tile.js']) {
        expect(readFileSync(new URL(filename, output), 'utf8')).toBe(
            readFileSync(new URL(`../dist/frontend/${filename}`, import.meta.url), 'utf8')
        );
    }
    for (const filename of ['index.html', 'challenges.json', 'activities-terminus.json']) {
        expect(readFileSync(new URL(filename, output), 'utf8')).toBe(
            readFileSync(new URL(filename, source), 'utf8')
        );
    }
    expect(readdirSync(output, {recursive: true}).some(path =>
        String(path).endsWith('.ts') || String(path).endsWith('.test.js')
    )).toBe(false);
    expect(existsSync(new URL('css/base.css', output))).toBe(true);
}, 15000);
