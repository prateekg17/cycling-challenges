import {readFileSync, readdirSync, existsSync} from 'fs';
import {join} from 'path';
import {load} from 'js-yaml';

export interface ChallengeConfig {
    slug: string;
    name: string;
    description: string;
    total: number;
    gradient: [string, string];
    filterKeyword: string;
    startDate: string;
    dataFile: string;
}

const REQUIRED_FIELDS: (keyof ChallengeConfig)[] = [
    'slug', 'name', 'description', 'total', 'gradient',
    'filterKeyword', 'startDate', 'dataFile'
];

export function validateChallengeConfig(raw: unknown): ChallengeConfig {
    if (typeof raw !== 'object' || raw === null) {
        throw new Error('Challenge config must be an object');
    }
    const obj = raw as Record<string, unknown>;
    for (const field of REQUIRED_FIELDS) {
        if (obj[field] === undefined || obj[field] === null) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    const g = obj['gradient'];
    if (!Array.isArray(g) || g.length !== 2 || g.some((v: unknown) => typeof v !== 'string')) {
        throw new Error('gradient must be a two-element array of strings');
    }
    if (typeof obj['total'] !== 'number') {
        throw new Error('total must be a number');
    }
    return obj as unknown as ChallengeConfig;
}

export function loadChallenges(challengesDir: string): ChallengeConfig[] {
    const entries = readdirSync(challengesDir, {withFileTypes: true});
    const configs: ChallengeConfig[] = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const configPath = join(challengesDir, entry.name, 'config.yaml');
        if (!existsSync(configPath)) continue;
        const raw = load(readFileSync(configPath, 'utf8'));
        configs.push(validateChallengeConfig(raw));
    }

    return configs;
}
