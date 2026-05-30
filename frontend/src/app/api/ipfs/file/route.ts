import { NextResponse } from 'next/server';
import { pinFileToPinata, validatePinataFile } from '@/lib/ipfsServer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!(file instanceof File)) {
            return NextResponse.json(
                { success: false, error: 'A file is required.' },
                { status: 400 }
            );
        }

        const validationError = validatePinataFile(file);

        if (validationError) {
            return NextResponse.json(
                { success: false, error: validationError },
                { status: 400 }
            );
        }

        const cid = await pinFileToPinata(file);

        return NextResponse.json({ success: true, cid });
    } catch (error: any) {
        console.error('[api/ipfs/file] Failed to pin file:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to upload file to IPFS.' },
            { status: 500 }
        );
    }
}