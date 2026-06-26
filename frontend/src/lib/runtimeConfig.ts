import { StrKey } from '@stellar/stellar-sdk';

export type StellarNetworkKind = 'testnet' | 'mainnet' | 'custom';
export type ContractName = 'CREDENTIAL_NFT' | 'CREDENTIAL_REGISTRY';

type StellarNetworkConfig = {
    kind: StellarNetworkKind;
    horizonUrl: string;
    sorobanRpcUrl: string;
    networkPassphrase: string;
    networkName: string;
    explorerBaseUrl: string;
};

type RuntimeConfig = {
    isProduction: boolean;
    supabase: {
        url: string;
        anonKey: string;
        serviceRoleKey: string;
    };
    stellar: StellarNetworkConfig;
    contracts: Record<ContractName, string>;
    ipfs: {
        gatewayUrl: string;
    };
};

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

const NETWORK_DEFAULTS: Record<Exclude<StellarNetworkKind, 'custom'>, StellarNetworkConfig> = {
    testnet: {
        kind: 'testnet',
        horizonUrl: 'https://horizon-testnet.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
        networkPassphrase: TESTNET_PASSPHRASE,
        networkName: 'testnet',
        explorerBaseUrl: 'https://stellar.expert/explorer/testnet',
    },
    mainnet: {
        kind: 'mainnet',
        horizonUrl: 'https://horizon.stellar.org',
        sorobanRpcUrl: 'https://soroban-mainnet.stellar.org',
        networkPassphrase: MAINNET_PASSPHRASE,
        networkName: 'public',
        explorerBaseUrl: 'https://stellar.expert/explorer/public',
    },
};

function cleanEnv(name: string): string {
    return process.env[name]?.trim() ?? '';
}

function looksLikePlaceholder(value: string): boolean {
    const normalized = value.toLowerCase();
    return (
        normalized.includes('your-project') ||
        normalized.startsWith('your_') ||
        normalized.startsWith('your-') ||
        normalized.includes('example.com')
    );
}

function configError(message: string): never {
    throw new Error(`[runtime-config] ${message}`);
}

function requireProductionValue(name: string, value: string, isProduction: boolean): string {
    if (isProduction && (!value || looksLikePlaceholder(value))) {
        configError(`${name} is required in production and must not be a placeholder value.`);
    }

    return value;
}

function parseHttpUrl(name: string, value: string): string {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
            configError(`${name} must be an HTTP or HTTPS URL.`);
        }

        return url.toString().replace(/\/$/, '');
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('[runtime-config]')) {
            throw error;
        }

        configError(`${name} must be a valid URL.`);
    }
}

function optionalHttpUrl(name: string, value: string): string {
    return value ? parseHttpUrl(name, value) : '';
}

function parseNetworkKind(isProduction: boolean): StellarNetworkKind {
    const value = (cleanEnv('NEXT_PUBLIC_STELLAR_NETWORK') || cleanEnv('NEXT_PUBLIC_CHAIN_ID'))
        .toLowerCase()
        .trim();

    if (!value) {
        if (isProduction) {
            configError(
                'NEXT_PUBLIC_STELLAR_NETWORK is required in production. Use testnet, mainnet, or custom.',
            );
        }

        return 'testnet';
    }

    if (value === 'testnet' || value === 'mainnet' || value === 'custom') {
        return value;
    }

    configError('NEXT_PUBLIC_STELLAR_NETWORK must be testnet, mainnet, or custom.');
}

function requireCustomValue(name: string, value: string, networkKind: StellarNetworkKind): string {
    if (networkKind === 'custom' && !value) {
        configError(`${name} is required when NEXT_PUBLIC_STELLAR_NETWORK=custom.`);
    }

    return value;
}

function buildStellarConfig(isProduction: boolean): StellarNetworkConfig {
    const kind = parseNetworkKind(isProduction);
    const defaults = kind === 'custom' ? null : NETWORK_DEFAULTS[kind];

    const horizonValue =
        cleanEnv('NEXT_PUBLIC_HORIZON_URL') || defaults?.horizonUrl || '';
    const rpcValue =
        cleanEnv('NEXT_PUBLIC_SOROBAN_RPC_URL') || defaults?.sorobanRpcUrl || '';
    const passphraseValue =
        cleanEnv('NEXT_PUBLIC_NETWORK_PASSPHRASE') || defaults?.networkPassphrase || '';
    const networkName =
        cleanEnv('NEXT_PUBLIC_NETWORK_NAME') || defaults?.networkName || 'custom';
    const explorerValue =
        cleanEnv('NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL') || defaults?.explorerBaseUrl || '';

    const networkPassphrase = requireCustomValue(
        'NEXT_PUBLIC_NETWORK_PASSPHRASE',
        passphraseValue,
        kind,
    );

    if (defaults && networkPassphrase !== defaults.networkPassphrase) {
        configError(
            `NEXT_PUBLIC_NETWORK_PASSPHRASE does not match the selected ${kind} network.`,
        );
    }

    return {
        kind,
        horizonUrl: parseHttpUrl(
            'NEXT_PUBLIC_HORIZON_URL',
            requireCustomValue('NEXT_PUBLIC_HORIZON_URL', horizonValue, kind),
        ),
        sorobanRpcUrl: parseHttpUrl(
            'NEXT_PUBLIC_SOROBAN_RPC_URL',
            requireCustomValue('NEXT_PUBLIC_SOROBAN_RPC_URL', rpcValue, kind),
        ),
        networkPassphrase,
        networkName,
        explorerBaseUrl: parseHttpUrl(
            'NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL',
            requireCustomValue('NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL', explorerValue, kind),
        ),
    };
}

function readContractId(name: ContractName, envName: string, isProduction: boolean): string {
    const value = requireProductionValue(envName, cleanEnv(envName), isProduction);
    if (value && !StrKey.isValidContract(value)) {
        configError(`${envName} must be a valid Stellar contract ID for ${name}.`);
    }

    return value;
}

function buildRuntimeConfig(): RuntimeConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    const supabaseUrl = requireProductionValue(
        'NEXT_PUBLIC_SUPABASE_URL',
        cleanEnv('NEXT_PUBLIC_SUPABASE_URL'),
        isProduction,
    );
    const supabaseAnonKey = requireProductionValue(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        cleanEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        isProduction,
    );
    const ipfsGateway =
        cleanEnv('NEXT_PUBLIC_PINATA_GATEWAY') || 'https://gateway.pinata.cloud';

    return {
        isProduction,
        supabase: {
            url: optionalHttpUrl('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl),
            anonKey: supabaseAnonKey,
            serviceRoleKey: cleanEnv('SUPABASE_SERVICE_ROLE_KEY'),
        },
        stellar: buildStellarConfig(isProduction),
        contracts: {
            CREDENTIAL_NFT: readContractId(
                'CREDENTIAL_NFT',
                'NEXT_PUBLIC_CREDENTIAL_NFT_CONTRACT',
                isProduction,
            ),
            CREDENTIAL_REGISTRY: readContractId(
                'CREDENTIAL_REGISTRY',
                'NEXT_PUBLIC_CREDENTIAL_REGISTRY_CONTRACT',
                isProduction,
            ),
        },
        ipfs: {
            gatewayUrl: parseHttpUrl('NEXT_PUBLIC_PINATA_GATEWAY', ipfsGateway),
        },
    };
}

export const runtimeConfig = buildRuntimeConfig();

export function getConfiguredContractId(contractName: ContractName): string {
    const contractId = runtimeConfig.contracts[contractName];
    if (!contractId) {
        configError(
            `Missing contract ID for ${contractName}. Set NEXT_PUBLIC_${contractName}_CONTRACT.`,
        );
    }

    return contractId;
}

export function assertValidStellarPublicKey(value: unknown, label = 'Wallet address'): string {
    if (typeof value !== 'string' || !StrKey.isValidEd25519PublicKey(value.trim())) {
        configError(`${label} must be a valid Stellar public key.`);
    }

    return value.trim();
}
