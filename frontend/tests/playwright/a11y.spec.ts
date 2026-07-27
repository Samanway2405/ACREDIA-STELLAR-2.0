import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createE2eState, installE2eRoutes, seedE2eState } from './e2e-support';

async function runAxe(page: Page) {
    const axeModule = await import('axe-core');
    const axeSource = axeModule.source ?? axeModule.default.source;
    await page.addScriptTag({ content: axeSource });
    return page.evaluate(async () => {
        const axe = (window as Window & { axe: { run: (node: Element) => Promise<{ violations: Array<{ id: string; impact?: string; help: string }> }> } }).axe;
        return axe.run(document.documentElement, {
            runOnly: {
                type: 'tag',
                values: ['wcag2a', 'wcag2aa'],
            },
        });
    });
}

test('register and verify pages stay accessible', async ({ page }) => {
    await page.goto('/auth/register?role=institution');
    const registerResults = await runAxe(page);
    expect(registerResults.violations, JSON.stringify(registerResults.violations, null, 2)).toEqual([]);

    const state = createE2eState({
        role: 'institution',
        walletAddress: 'GAcrediaIssuerWallet0000000000000000000000000000001',
        authorizedIssuers: ['GAcrediaIssuerWallet0000000000000000000000000000001'],
        issuedCredentials: [
            {
                id: 'cred-1',
                token_id: '1',
                ipfs_hash: 'e2e-metadata-cid',
                blockchain_hash: 'e2e-tx-1',
                metadata: {
                    credentialData: {
                        studentName: 'Ada Lovelace',
                        degree: 'Bachelor of Science',
                        credentialType: 'diploma',
                        issueDate: '2026-07-27',
                    },
                },
                issued_at: new Date().toISOString(),
                revoked: false,
                issuer_wallet_address: 'GAcrediaIssuerWallet0000000000000000000000000000001',
                student_wallet_address: 'GAcrediaStudentWallet000000000000000000000000000000',
            },
        ],
    });

    await seedE2eState(page, state);
    await installE2eRoutes(page);

    await page.goto('/verify?token=1');
    const verifyResults = await runAxe(page);
    expect(verifyResults.violations, JSON.stringify(verifyResults.violations, null, 2)).toEqual([]);
});
