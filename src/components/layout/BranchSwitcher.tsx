import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePOSStore } from '@/stores/posStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { cn } from '@/lib/utils';


interface Branch {
    id: string;
    name: string;
    is_active: boolean;
}

interface BranchSwitcherProps {
    collapsed: boolean;
}

export function BranchSwitcher({ collapsed }: BranchSwitcherProps) {
    const { brandId, branchId, setBranch, user } = useAuthStore();
    const [branches, setBranches] = useState<Branch[]>([]);


    // Check permission - mainly for admins/owners. 
    // Staff might be locked to a branch, but let's allow switching if they have access to multiple (complex logic).
    // For now, assume any logged in user can switch if they belong to the brand (simplification).
    // NEW: Respect assigned_branch_id locking
    const isLocked = !!user?.assigned_branch_id;
    const canSwitch = !isLocked && (user?.role === 'admin' || user?.role === 'owner' || user?.role === 'manager');

    useEffect(() => {
        // DEMO MODE: Mock branches
        if (!isSupabaseConfigured() || !supabase) {
            const demoBranches = [
                { id: 'demo-branch', name: 'Chi nhánh Trung tâm', is_active: true },
                { id: 'demo-branch-2', name: 'Chi nhánh 2 (Demo)', is_active: true }
            ];
            setBranches(demoBranches);

            // Ensure authStore matches one of these if not already
            if (!branchId || (branchId !== 'demo-branch' && branchId !== 'demo-branch-2')) {
                setBranch('demo-branch');
            }
            return;
        }

        const fetchBranches = async () => {
            console.log('BranchSwitcher: Fetching branches for Brand:', brandId);
            if (!brandId) return;

            try {
                const { data, error } = await supabase
                    .from('branches')
                    .select('*')
                    .eq('brand_id', brandId);
                // .eq('is_active', true) // Filter in memory to match BranchesPage logic if necessary, or just rely on RLS
                // .order('is_default', { ascending: false });

                if (error) {
                    console.error('BranchSwitcher: Supabase Error', JSON.stringify(error, null, 2));
                    throw error;
                }

                // Filter active branches
                // DB status might be number (1) or string ('active') or boolean (is_active)
                const activeBranches = (data || []).filter((b: any) =>
                    b.is_active === true ||
                    b.status === 'active' ||
                    b.status === 1
                );

                console.log('BranchSwitcher: Raw data:', data);
                console.log('BranchSwitcher: Active branches after filter:', activeBranches);
                setBranches(activeBranches);
            } catch (error) {
                console.error('Error fetching branches:', error);
            }
        };

        if (canSwitch) {
            console.log('BranchSwitcher: canSwitch is true. Role:', user?.role);
            fetchBranches();
        } else {
            console.log('BranchSwitcher: canSwitch is FALSE. Role:', user?.role);
        }
    }, [brandId, canSwitch, branchId, setBranch, user?.role]);

    // Safety check: Don't render empty dropdown
    if (branches.length === 0) {
        console.log('BranchSwitcher: Hiding because branches.length is 0');
        return null;
    }

    if (!canSwitch && branches.length <= 1) {
        // If only 1 branch or no permission, just show the name static or nothing?
        // Let's show nothing if only 1 branch to reduce clutter, or just static text.
        // If we want to show current branch name even if single, we can.
        // But for "Switcher", sticking to hiding if single is cleaner.
        if (branches.length === 1 && !collapsed) {
            const current = branches[0];
            return (
                <div className="px-3 py-2 text-xs text-gray-500 font-medium border-b border-gray-100 mb-2">
                    {current.name}
                </div>
            );
        }
        return null;
    }

    // If only 1 branch, show read-only view
    if (branches.length === 1) {
        const current = branches[0];
        if (collapsed) return null; // Still hide in collapsed mode for single branch

        return (
            <div className="px-3 mb-2">
                <div className="w-full bg-gray-50 border border-gray-100 text-gray-500 py-2 px-3 rounded-lg text-sm font-medium flex items-center gap-2 cursor-default" title="Chi nhánh hiện tại">
                    <BranchIcon className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{current.name}</span>
                </div>
            </div>
        );
    }

    if (collapsed) {
        // Just show an icon or nothing when collapsed
        return (
            <div className="flex justify-center mb-2" title="Chuyển chi nhánh">
                <BranchIcon className="w-5 h-5 text-gray-400" />
            </div>
        );
    }

    return (
        <div className="px-3 mb-2">
            <div className="relative">
                <select
                    className={cn(
                        "w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 pl-8 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
                    )}
                    value={branchId || ''}
                    onChange={(e) => {
                        setBranch(e.target.value);
                        usePOSStore.getState().clearCart('Chuyển chi nhánh');
                    }}
                >
                    {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                            {branch.name}
                        </option>
                    ))}
                </select>
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <BranchIcon className="h-4 w-4 text-gray-500" />
                </div>
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>
        </div>
    );
}

function BranchIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
        </svg>
    );
}
