import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtime config environment validation', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        delete process.env.NEXT_PHASE;
        vi.unstubAllEnvs();
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        vi.resetModules();
        vi.unstubAllEnvs();
    });

    it('logs a clear error and degrades gracefully when required runtime values are missing', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Importing must NOT throw: a missing public value should never crash the
        // whole app (which would show the global error screen in the browser or
        // fail the production build). It degrades to empty values instead.
        const mod = await import('../src/lib/runtimeConfig');

        expect(mod.runtimeConfig.supabase.url).toBe('');
        expect(mod.runtimeConfig.supabase.anonKey).toBe('');
        expect(mod.runtimeConfig.isProduction).toBe(true);

        // The misconfiguration is still surfaced loudly and actionably.
        expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/NEXT_PUBLIC_SUPABASE_URL/));

        errorSpy.mockRestore();
    });

    it('exposes a typed server runtime config for admin and pinata settings', async () => {
        vi.stubEnv('NODE_ENV', 'test');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');

        const { serverRuntimeConfig } = await import('../src/lib/runtimeConfig');

        expect(serverRuntimeConfig.admin.emailAllowlist).toEqual([]);
        expect(serverRuntimeConfig.debug.enableLogs).toBe(false);
    });

    it('enforces single-switch network profiles for testnet/mainnet defaults', async () => {
        vi.stubEnv('NODE_ENV', 'test');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
        vi.stubEnv('NEXT_PUBLIC_STELLAR_NETWORK', 'mainnet');
        vi.stubEnv('NEXT_PUBLIC_HORIZON_URL', 'https://horizon-testnet.stellar.org');

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const mod = await import('../src/lib/runtimeConfig');

        // Falls back instead of crashing app boot, but surfaces the profile violation.
        expect(mod.runtimeConfig.stellar.kind).toBe('testnet');
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringMatching(/cannot override the mainnet profile/),
        );

        errorSpy.mockRestore();
    });

    it('rejects server-only secret names in NEXT_PUBLIC variables', async () => {
        vi.stubEnv('NODE_ENV', 'test');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
        vi.stubEnv('NEXT_PUBLIC_PINATA_JWT', 'eyJ.fake.jwt');

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const mod = await import('../src/lib/runtimeConfig');

        // App boot degrades safely while logging the exact misconfiguration.
        expect(mod.runtimeConfig.supabase.url).toBe('https://example.supabase.co');
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringMatching(/Server-only secrets must never be exposed via NEXT_PUBLIC_\*/),
        );

        errorSpy.mockRestore();
    });
});
