// =============================================================================
// BASE STORE HELPER
// Standardizes loading and error state management across all stores
// =============================================================================

export interface BaseState {
    isLoading: boolean;
    error: string | null;
}

export const createBaseState = (): BaseState => ({
    isLoading: false,
    error: null,
});

/**
 * Helper to wrap async actions with loading and error handling
 * @param set - Zustand set function
 * @param fn - The async action to execute
 * @param errorMessage - Custom error message to display on failure
 */
export const withAsync = async <T,>(
    set: (partial: Partial<BaseState> | ((state: any) => Partial<BaseState>)) => void,
    fn: () => Promise<T>,
    errorMessage: string = 'Đã xảy ra lỗi'
): Promise<T | null> => {
    set({ isLoading: true, error: null });
    try {
        const result = await fn();
        set({ isLoading: false });
        // Return null if result is undefined to match Promise<T | null> signature if needed, 
        // but usually we just return the result.
        // If T is void, it returns undefined.
        return result;
    } catch (err: any) {
        console.error(errorMessage, err);
        const detail = err.message || err.error_description || 'Unknown error';
        set({
            isLoading: false,
            error: `${errorMessage}: ${detail}`
        });
        return null;
    }
};
