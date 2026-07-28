import { NextResponse } from 'next/server';

type RateLimitOptions = {
    windowSeconds: number;
    maxRequests: number;
    prefix?: string;
    /**
     * Bucket the limit on this value instead of the client IP. Use for
     * per-user quotas on authenticated routes, where a single account must not
     * be able to sidestep its quota by rotating source addresses.
     */
    identifier?: string;
};

type RateLimitResult = {
    success: boolean;
    remaining: number;
    retryAfter: number;
};

export type RateLimitBucket = { count: number; resetAt: number };

export type RateLimitStore = {
    increment: (key: string, windowSeconds: number) => Promise<{ count: number; resetAt: number }>;
    reset?: () => void;
};

const fixedBuckets = new Map<string, RateLimitBucket>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

export const getClientIp = (request: Request): string => {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        const [firstIp] = forwardedFor.split(',');
        if (firstIp?.trim()) {
            return firstIp.trim();
        }
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp?.trim()) {
        return realIp.trim();
    }

    const requestWithIp = request as Request & { ip?: string | null };
    if (requestWithIp.ip?.trim()) {
        return requestWithIp.ip.trim();
    }

    return 'unknown';
};

function cleanupStaleBuckets(now: number, store = fixedBuckets) {
    for (const [key, bucket] of store.entries()) {
        if (bucket.resetAt <= now) {
            store.delete(key);
        }
    }
    lastCleanup = now;
}

export function createInMemoryRateLimitStore(
    store: Map<string, RateLimitBucket> = new Map(),
): RateLimitStore {
    return {
        async increment(key: string, windowSeconds: number) {
            const now = Date.now();
            if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
                cleanupStaleBuckets(now, store);
            }

            const existing = store.get(key);
            if (!existing || existing.resetAt <= now) {
                const bucket = { count: 1, resetAt: now + windowSeconds * 1000 };
                store.set(key, bucket);
                return bucket;
            }

            existing.count += 1;
            store.set(key, existing);
            return existing;
        },
        reset() {
            store.clear();
            lastCleanup = Date.now();
        },
    };
}

function createUpstashRateLimitStore(): RateLimitStore | null {
    const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;

    return {
        async increment(key: string, windowSeconds: number) {
            const response = await fetch(`${url}/pipeline`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify([
                    ['INCR', key],
                    ['EXPIRE', key, windowSeconds, 'NX'],
                    ['TTL', key],
                ]),
            });

            if (!response.ok) {
                throw new Error(`Redis rate limit check failed: ${response.status}`);
            }

            const [countResult, , ttlResult] = await response.json() as Array<{ result?: unknown }>;
            const count = Number(countResult?.result ?? 1);
            const ttl = Number(ttlResult?.result ?? windowSeconds);

            return {
                count,
                resetAt: Date.now() + Math.max(1, ttl) * 1000,
            };
        },
    };
}

let activeStore = createUpstashRateLimitStore() ?? createInMemoryRateLimitStore(fixedBuckets);

function readEnvOverride(prefix: string | undefined, name: 'WINDOW_SECONDS' | 'MAX_REQUESTS'): number | null {
    if (!prefix) return null;
    const envName = `RATE_LIMIT_${prefix.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_${name}`;
    const raw = process.env[envName];
    if (!raw) return null;

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export const setRateLimitStoreForTests = (store: RateLimitStore) => {
    activeStore = store;
};

export const checkRateLimit = async (
    request: Request,
    { windowSeconds, maxRequests, prefix = 'api', identifier }: RateLimitOptions,
): Promise<RateLimitResult> => {
    const effectiveWindowSeconds = readEnvOverride(prefix, 'WINDOW_SECONDS') ?? windowSeconds;
    const effectiveMaxRequests = readEnvOverride(prefix, 'MAX_REQUESTS') ?? maxRequests;
    const subject = identifier?.trim() || getClientIp(request);
    const key = `${prefix}:${subject}`;
    const bucket = await activeStore.increment(key, effectiveWindowSeconds);

    if (bucket.count > effectiveMaxRequests) {
        return {
            success: false,
            remaining: 0,
            retryAfter: Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000)),
        };
    }

    return {
        success: true,
        remaining: Math.max(0, effectiveMaxRequests - bucket.count),
        retryAfter: 0,
    };
};

export const enforceRateLimit = async (
    request: Request,
    options: RateLimitOptions,
): Promise<NextResponse | null> => {
    const result = await checkRateLimit(request, options);

    if (result.success) {
        return null;
    }

    return NextResponse.json(
        { success: false, error: 'Too many requests' },
        {
            status: 429,
            headers: {
                'Retry-After': String(result.retryAfter),
            },
        },
    );
};

export const resetRateLimitStore = () => {
    activeStore.reset?.();
};
