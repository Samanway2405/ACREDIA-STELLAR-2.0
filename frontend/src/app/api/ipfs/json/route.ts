import { NextResponse } from 'next/server';
import { pinJsonToPinata, validatePinataJson } from '@/lib/ipfsServer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        const content = payload?.content;
        const validationError = validatePinataJson(content);

        if (validationError) {
            return NextResponse.json(
                { success: false, error: validationError },
                { status: 400 }
            );
        }

        const cid = await pinJsonToPinata(content);

        return NextResponse.json({ success: true, cid });
    } catch (error: any) {
        console.error('[api/ipfs/json] Failed to pin JSON:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to upload JSON to IPFS.' },
            { status: 500 }
        );
    }
}