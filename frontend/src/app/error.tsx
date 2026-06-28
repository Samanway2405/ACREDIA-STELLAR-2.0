'use client';

import { useEffect } from 'react';
import { RouteStateScreen } from '@/components/route-state/RouteStateScreen';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error('Route error:', error);
        if (typeof window !== 'undefined' && 'gtag' in window) {
            (window as Window & { gtag?: (...args: unknown[]) => void }).gtag?.('event', 'exception', {
                description: error.message,
                fatal: false,
            });
        }
    }, [error]);

    return (
        <RouteStateScreen
            title="Something went wrong"
            description="We could not complete that request. Please try again, or return home and continue from there."
            actionLabel="Try again"
            secondaryActionLabel="Back to home"
            onAction={reset}
            variant="error"
        />
    );
}
