import {readFileSync, readdirSync} from 'fs';
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
    return obj as unknown as ChallengeConfig;
}

export function loadChallenges(challengesDir: string): ChallengeConfig[] {
    const entries = readdirSync(challengesDir, {withFileTypes: true});
    const configs: ChallengeConfig[] = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const configPath = join(challengesDir, entry.name, 'config.yaml');
        const raw = load(readFileSync(configPath, 'utf8'));
        configs.push(validateChallengeConfig(raw));
    }

    return configs;
}
