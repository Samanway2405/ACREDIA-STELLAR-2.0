export interface ExportCredentialData {
    tokenId: string;
    studentName?: string;
    studentWallet?: string;
    institutionName?: string;
    issuerWallet?: string;
    degree?: string;
    credentialType?: string;
    issueDate?: string;
    issuedAt?: string;
    ipfsHash?: string;
    blockchainHash?: string;
    revoked?: boolean;
}

export function exportW3cVerifiableCredential(credential: ExportCredentialData): Record<string, unknown> {
    const issueDate = credential.issueDate || credential.issuedAt || new Date().toISOString();
    return {
        '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.1.json',
        ],
        id: `urn:uuid:acredia-token-${credential.tokenId}`,
        type: ['VerifiableCredential', 'OpenBadgeCredential'],
        issuer: {
            id: credential.issuerWallet ? `did:stellar:${credential.issuerWallet}` : 'urn:acredia:issuer:unknown',
            name: credential.institutionName || 'Acredia Institution',
        },
        issuanceDate: new Date(issueDate).toISOString(),
        credentialSubject: {
            id: credential.studentWallet ? `did:stellar:${credential.studentWallet}` : `urn:acredia:student:${credential.tokenId}`,
            name: credential.studentName || 'Student',
            degree: credential.degree || 'Academic Credential',
            credentialType: credential.credentialType || 'diploma',
        },
        proof: {
            type: 'Ed25519Signature2020',
            created: new Date(issueDate).toISOString(),
            proofPurpose: 'assertionMethod',
            verificationMethod: credential.issuerWallet
                ? `did:stellar:${credential.issuerWallet}#key-1`
                : 'urn:acredia:issuer:key-1',
            proofValue: credential.blockchainHash || `e2e-proof-${credential.tokenId}`,
        },
    };
}

export function exportOpenBadgesV3(credential: ExportCredentialData): Record<string, unknown> {
    const issueDate = credential.issueDate || credential.issuedAt || new Date().toISOString();
    return {
        '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.1.json',
        ],
        id: `urn:uuid:acredia-obv3-${credential.tokenId}`,
        type: ['VerifiableCredential', 'OpenBadgeCredential'],
        name: credential.degree || 'Academic Credential',
        description: `Verified ${credential.credentialType || 'credential'} issued by ${credential.institutionName || 'Acredia Institution'} on the Stellar blockchain.`,
        issuer: {
            id: credential.issuerWallet ? `urn:acredia:issuer:${credential.issuerWallet}` : 'urn:acredia:issuer:unknown',
            type: ['Profile'],
            name: credential.institutionName || 'Acredia Institution',
        },
        issuanceDate: new Date(issueDate).toISOString(),
        credentialSubject: {
            id: credential.studentWallet ? `urn:acredia:student:${credential.studentWallet}` : `urn:acredia:student:${credential.tokenId}`,
            type: ['AchievementSubject'],
            achievement: {
                id: `urn:acredia:achievement:${credential.tokenId}`,
                type: ['Achievement'],
                name: credential.degree || 'Academic Credential',
                description: `Academic ${credential.credentialType || 'credential'} verified on-chain.`,
                criteria: {
                    narrative: 'Issued upon successful completion and verification of academic requirements.',
                },
            },
        },
    };
}

export function getLinkedInShareUrl(credential: {
    title: string;
    institutionName: string;
    issueDate?: string;
    tokenId: string;
    certUrl: string;
}): string {
    const issueDateObj = credential.issueDate ? new Date(credential.issueDate) : new Date();
    const issueYear = issueDateObj.getFullYear();
    const issueMonth = issueDateObj.getMonth() + 1;

    const params = new URLSearchParams({
        startTask: 'CERTIFICATION_NAME',
        name: credential.title || 'Academic Credential',
        organizationName: credential.institutionName || 'Acredia Institution',
        issueYear: String(issueYear),
        issueMonth: String(issueMonth),
        certUrl: credential.certUrl,
        certId: credential.tokenId,
    });

    return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export function downloadJsonFile(data: Record<string, unknown>, filename: string): void {
    if (typeof window === 'undefined') return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
