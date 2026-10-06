import {afterEach, describe, expect, it, vi} from 'vitest';
import {createChallengeTile} from './challenge-tile.js';

afterEach(() => vi.unstubAllGlobals());

describe('createChallengeTile', () => {
    it.each([
        ["St. Paul's & London's Views", 'Cycle to the protected viewpoints.'],
        ['"><img src=x onerror=alert(1)>', '</p><script>alert(1)</script><p>']
    ])('keeps name %s and description as text, not markup', (name, description) => {
        const fields = {
            '.challenge-tile__name': {textContent: ''},
            '.challenge-tile__description': {textContent: ''},
            '.challenge-tile__progress-pct': {textContent: ''}
        };
        const tile = {
            style: {},
            dataset: {},
            innerHTML: '',
            setAttribute: vi.fn(),
            querySelector: vi.fn(selector => fields[selector])
        };
        const createElement = vi.fn(() => tile);
        vi.stubGlobal('document', {createElement});

        expect(createChallengeTile({
            slug: 'protected-views',
            name,
            description,
            gradient: ['#393936', '#777771'],
            targetRideCount: 8
        })).toBe(tile);

        expect(createElement).toHaveBeenCalledWith('button');
        expect(tile.type).toBe('button');
        expect(tile.className).toBe('challenge-tile');
        expect(tile.dataset.slug).toBe('protected-views');
        expect(tile.style.background).toBe('linear-gradient(135deg, #393936, #777771)');
        expect(tile.setAttribute).toHaveBeenCalledExactlyOnceWith('aria-label', `Open ${name}`);
        expect(fields['.challenge-tile__name'].textContent).toBe(name);
        expect(fields['.challenge-tile__description'].textContent).toBe(description);
        expect(fields['.challenge-tile__progress-pct'].textContent).toBe('0 / 8 rides');
        expect(tile.innerHTML).not.toContain(name);
        expect(tile.innerHTML).not.toContain(description);
        expect(tile.innerHTML).toContain('challenge-tile__progress-fill');
    });
});
