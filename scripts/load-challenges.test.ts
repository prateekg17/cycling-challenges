import {describe, it, expect} from 'vitest';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('loadChallenges', () => {
    it('loads the terminus config from the challenges directory', async () => {
        const {loadChallenges} = await import('./load-challenges.js');
        const configs = loadChallenges(join(__dirname, '..', 'challenges'));
        expect(configs.length).toBeGreaterThanOrEqual(1);
        const c = configs.find(x => x.slug === 'terminus');
        expect(c).toBeDefined();
        if (!c) return;
        expect(c.slug).toBe('terminus');
        expect(c.name).toBe('Tube Terminus Challenge');
        expect(c.total).toBe(33);
        expect(c.gradient).toEqual(['#1b4332', '#40916c']);
        expect(c.filterKeyword).toBe('terminus');
        expect(c.startDate).toBe('2025-03-22T00:00:00Z');
        expect(c.dataFile).toBe('activities-terminus.json');
        expect(c.description).toBe('Cycle to all 33 London Underground terminus stations from home');
    });

    it('throws for a config missing required fields', async () => {
        const {validateChallengeConfig} = await import('./load-challenges.js');
        expect(() => validateChallengeConfig({slug: 'test'} as any)).toThrow(/missing required field/i);
        expect(() => validateChallengeConfig(null)).toThrow();
        expect(() => validateChallengeConfig('string')).toThrow();
    });
});
