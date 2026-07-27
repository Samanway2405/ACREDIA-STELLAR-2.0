import { defineConfig, devices } from '@playwright/test';

const webServerEnv = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder',
    SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
    NEXT_PUBLIC_CREDENTIAL_NFT_CONTRACT: 'CARWFW27MJ3OJADAUAHI3TDFHIL62YMLVEKTUTMSNXOMH7JJTNZKC3DK',
    NEXT_PUBLIC_CREDENTIAL_REGISTRY_CONTRACT: 'CARWFW27MJ3OJADAUAHI3TDFHIL62YMLVEKTUTMSNXOMH7JJTNZKC3DK',
    NEXT_PUBLIC_CHAIN_ID: 'testnet',
    NEXT_PUBLIC_NETWORK_NAME: 'testnet',
    NEXT_PUBLIC_HORIZON_URL: 'https://horizon-testnet.stellar.org',
    NEXT_PUBLIC_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
    NEXT_PUBLIC_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
    PINATA_JWT: 'placeholder-pinata-jwt',
    NEXT_PUBLIC_PINATA_GATEWAY: 'https://gateway.pinata.cloud',
    NEXT_PUBLIC_ENABLE_DEBUG_LOGS: 'false',
    ADMIN_EMAIL_ALLOWLIST: 'admin@acredia.test',
};

export default defineConfig({
    testDir: './tests/playwright',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 45_000,
    expect: {
        timeout: 10_000,
    },
    use: {
        baseURL: 'http://127.0.0.1:3000',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run dev -- --port 3000',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: true,
        timeout: 120_000,
        env: webServerEnv,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
