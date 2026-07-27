import { describe, expect, it } from 'vitest';
import {
    exportW3cVerifiableCredential,
    exportOpenBadgesV3,
    getLinkedInShareUrl,
} from '../src/lib/standardsExport';

describe('Standards Export Generators', () => {
    const mockCredential = {
        tokenId: '123',
        studentName: 'Ada Lovelace',
        studentWallet: 'GBSVJNVIAGQEAK3WAAVGXSMT7BMLI4SHAJWKKMRCMJIYG7XESR4ANDZD',
        institutionName: 'Acredia Academy',
        issuerWallet: 'GAcrediaIssuerWallet0000000000000000000000000000001',
        degree: 'Bachelor of Science in Computer Science',
        credentialType: 'diploma',
        issueDate: '2024-01-15',
        blockchainHash: 'e2e-tx-hash-123',
    };

    it('generates a valid W3C Verifiable Credential structure', () => {
        const vc = exportW3cVerifiableCredential(mockCredential);
        expect(vc['@context']).toContain('https://www.w3.org/2018/credentials/v1');
        expect(vc.type).toContain('VerifiableCredential');
        expect((vc.issuer as { name: string }).name).toBe('Acredia Academy');
        expect((vc.credentialSubject as { degree: string }).degree).toBe('Bachelor of Science in Computer Science');
        expect((vc.proof as { proofValue: string }).proofValue).toBe('e2e-tx-hash-123');
    });

    it('generates a valid Open Badges v3 structure', () => {
        const obv3 = exportOpenBadgesV3(mockCredential);
        expect(obv3['@context']).toContain('https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.1.json');
        expect(obv3.name).toBe('Bachelor of Science in Computer Science');
        expect((obv3.issuer as { name: string }).name).toBe('Acredia Academy');
    });

    it('generates a properly formatted LinkedIn add certification URL', () => {
        const url = getLinkedInShareUrl({
            title: mockCredential.degree,
            institutionName: mockCredential.institutionName,
            issueDate: mockCredential.issueDate,
            tokenId: mockCredential.tokenId,
            certUrl: 'https://acredia.test/credentials/123',
        });

        expect(url).toContain('https://www.linkedin.com/profile/add?');
        expect(url).toContain('Bachelor+of+Science');
        expect(url).toContain('certId=123');
    });
});
