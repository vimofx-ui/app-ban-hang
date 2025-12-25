// =============================================================================
// useBreakpoint - Hook for responsive design
// =============================================================================

import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

interface BreakpointState {
    breakpoint: Breakpoint;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    width: number;
}

const BREAKPOINTS = {
    mobile: 0,
    tablet: 768,
    desktop: 1024,
};

export function useBreakpoint(): BreakpointState {
    const [state, setState] = useState<BreakpointState>(() => getBreakpointState());

    useEffect(() => {
        const handleResize = () => {
            setState(getBreakpointState());
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return state;
}

function getBreakpointState(): BreakpointState {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;

    let breakpoint: Breakpoint = 'desktop';
    if (width < BREAKPOINTS.tablet) {
        breakpoint = 'mobile';
    } else if (width < BREAKPOINTS.desktop) {
        breakpoint = 'tablet';
    }

    return {
        breakpoint,
        isMobile: breakpoint === 'mobile',
        isTablet: breakpoint === 'tablet',
        isDesktop: breakpoint === 'desktop',
        width,
    };
}

export default useBreakpoint;
