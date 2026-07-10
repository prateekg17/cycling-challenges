import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import type {StravaActivity} from './fetch-activities.js';

let mockFetch: ReturnType<typeof vi.fn> | undefined;
vi.mock('node-fetch', () => ({
    default: (url: string, options?: any) => {
        // Call as a plain function! Not as a constructor
        // @ts-ignore
        if (mockFetch) return mockFetch(url, options);
        return Promise.resolve({ ok: true, json: async () => ({}) });
    }
}));

function act(partial: Partial<StravaActivity>): StravaActivity {
    return {
        id: partial.id ?? Math.floor(Math.random() * 1e6),
        name: partial.name ?? '',
        start_date: partial.start_date ?? '2025-04-01T00:00:00Z',
        description: partial.description,
        distance: partial.distance,
        moving_time: partial.moving_time,
        total_elevation_gain: partial.total_elevation_gain
    };
}

describe('filterAndSortActivities', () => {
    it('filters only activities with terminus in name or description (case-insensitive) and sorts descending', async () => {
        const mod = await import('./fetch-activities.js');
        const {filterAndSortActivities} = mod;
        const activities: StravaActivity[] = [
            act({id: 1, name: 'Morning Ride', start_date: '2025-04-01T10:00:00Z'}),
            act({id: 2, name: 'Terminus Sprint', start_date: '2025-04-02T09:00:00Z'}),
            act({
                id: 3,
                name: 'Evening ride',
                description: 'Reached the TERMINUS finally',
                start_date: '2025-04-03T08:00:00Z'
            }),
            act({id: 4, name: 'Another terminus cruise', start_date: '2025-04-01T12:00:00Z'}),
            act({id: 5, name: 'Random', description: 'nothing special', start_date: '2025-03-31T12:00:00Z'})
        ];
        const result = filterAndSortActivities(activities, 'terminus');
        expect(result.map(a => a.id)).toEqual([3, 2, 4]);
    });

    it('returns empty array when no matches', async () => {
        const {filterAndSortActivities} = await import('./fetch-activities.js');
        const activities: StravaActivity[] = [act({id: 1, name: 'Ride A'}), act({id: 2, name: 'Ride B'})];
        expect(filterAndSortActivities(activities, 'terminus')).toEqual([]);
    });
});

describe('getAccessToken', () => {
    const OLD_ENV = process.env;
    beforeEach(() => {
        vi.resetModules();
        process.env = {...OLD_ENV};
        mockFetch = undefined;
    });
    afterEach(() => {
        process.env = OLD_ENV;
        mockFetch = undefined;
    });

    it('throws when env vars missing', async () => {
        delete process.env.STRAVA_CLIENT_ID;
        delete process.env.STRAVA_CLIENT_SECRET;
        delete process.env.STRAVA_REFRESH_TOKEN;
        const {getAccessToken} = await import('./fetch-activities.js');
        await expect(getAccessToken()).rejects.toThrow(/Missing Strava OAuth/);
    });

    it('returns token when API responds', async () => {
        process.env.STRAVA_CLIENT_ID = 'id';
        process.env.STRAVA_CLIENT_SECRET = 'secret';
        process.env.STRAVA_REFRESH_TOKEN = 'refresh';

        mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({access_token: 'abc123'})
        });

        const {getAccessToken} = await import('./fetch-activities.js');
        const token = await getAccessToken();
        expect(token).toBe('abc123');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});

describe('fetchActivitiesPage', () => {
    beforeEach(() => {
        mockFetch = undefined;
    });
    it('returns parsed activities array and includes query params', async () => {
        const mockActivities = [act({id: 10, name: 'Terminus test', start_date: '2025-04-04T00:00:00Z'})];
        mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockActivities
        });
        const {fetchActivitiesPage} = await import('./fetch-activities.js');
        const list = await fetchActivitiesPage('token', 1, '2025-03-22T00:00:00Z');
        expect(list).toEqual(mockActivities);
        const calledUrl: string = mockFetch.mock.calls[0][0];
        expect(calledUrl).toMatch(/page=1/);
        expect(calledUrl).toMatch(/after=\d+/);
        expect(calledUrl).toMatch(/before=\d+/);
    });
});
