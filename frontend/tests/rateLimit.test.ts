import { afterEach, describe, expect, it } from 'vitest';
import {
    checkRateLimit,
    createInMemoryRateLimitStore,
    resetRateLimitStore,
    setRateLimitStoreForTests,
    type RateLimitBucket,
} from '@/lib/rateLimit';

const originalVerifyLimit = process.env.RATE_LIMIT_VERIFY_MAX_REQUESTS;

afterEach(() => {
    if (typeof originalVerifyLimit === 'undefined') {
        delete process.env.RATE_LIMIT_VERIFY_MAX_REQUESTS;
    } else {
        process.env.RATE_LIMIT_VERIFY_MAX_REQUESTS = originalVerifyLimit;
    }

    setRateLimitStoreForTests(createInMemoryRateLimitStore());
    resetRateLimitStore();
});

function requestFrom(ip: string): Request {
    return new Request('http://localhost/api/verify/token-123', {
        headers: { 'x-forwarded-for': ip },
    });
}

describe('rateLimit', () => {
    it('enforces limits across simulated instances that share a backing store', async () => {
        const backingStore = new Map<string, RateLimitBucket>();
        const instanceA = createInMemoryRateLimitStore(backingStore);
        const instanceB = createInMemoryRateLimitStore(backingStore);

        setRateLimitStoreForTests(instanceA);
        await expect(checkRateLimit(requestFrom('203.0.113.50'), {
            prefix: 'verify',
            windowSeconds: 60,
            maxRequests: 2,
        })).resolves.toMatchObject({ success: true, remaining: 1 });

        setRateLimitStoreForTests(instanceB);
        await expect(checkRateLimit(requestFrom('203.0.113.50'), {
            prefix: 'verify',
            windowSeconds: 60,
            maxRequests: 2,
        })).resolves.toMatchObject({ success: true, remaining: 0 });

        await expect(checkRateLimit(requestFrom('203.0.113.50'), {
            prefix: 'verify',
            windowSeconds: 60,
            maxRequests: 2,
        })).resolves.toMatchObject({ success: false, remaining: 0 });
    });

    it('allows env overrides per route prefix', async () => {
        process.env.RATE_LIMIT_VERIFY_MAX_REQUESTS = '1';

        await expect(checkRateLimit(requestFrom('203.0.113.51'), {
            prefix: 'verify',
            windowSeconds: 60,
            maxRequests: 10,
        })).resolves.toMatchObject({ success: true });

        await expect(checkRateLimit(requestFrom('203.0.113.51'), {
            prefix: 'verify',
            windowSeconds: 60,
            maxRequests: 10,
        })).resolves.toMatchObject({ success: false });
    });
});
