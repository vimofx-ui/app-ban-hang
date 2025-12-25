// =============================================================================
// PAGINATION COMPONENT - Reusable pagination with page size selector
// =============================================================================

import { cn } from '@/lib/utils';

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    pageSizeOptions?: number[];
    className?: string;
}

export function Pagination({
    currentPage,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [20, 50, 100],
    className
}: PaginationProps) {
    const totalPages = Math.ceil(totalItems / pageSize);
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    // Generate page numbers to display
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible + 2) {
            // Show all pages if few
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            // Always show first page
            pages.push(1);

            if (currentPage > 3) {
                pages.push('...');
            }

            // Pages around current
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push('...');
            }

            // Always show last page
            if (!pages.includes(totalPages)) {
                pages.push(totalPages);
            }
        }

        return pages;
    };

    if (totalItems === 0) return null;

    return (
        <div className={cn('flex items-center justify-between flex-wrap gap-4 py-4', className)}>
            {/* Page size selector */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Hiển thị</span>
                <select
                    value={pageSize}
                    onChange={(e) => {
                        onPageSizeChange(Number(e.target.value));
                        onPageChange(1); // Reset to first page
                    }}
                    className="px-2 py-1 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    {pageSizeOptions.map(size => (
                        <option key={size} value={size}>{size}</option>
                    ))}
                </select>
            </div>

            {/* Info and pagination */}
            <div className="flex items-center gap-4">
                {/* Items info */}
                <span className="text-sm text-gray-500">
                    Kết quả <span className="font-medium text-gray-700">{startItem}-{endItem}</span> trên tổng <span className="font-medium text-gray-700">{totalItems.toLocaleString()}</span>
                </span>

                {/* Page buttons */}
                <div className="flex items-center gap-1">
                    {/* Previous button */}
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={cn(
                            'w-8 h-8 flex items-center justify-center rounded-lg border text-sm',
                            currentPage === 1
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-white hover:bg-gray-50 text-gray-600'
                        )}
                    >
                        ‹
                    </button>

                    {/* Page numbers */}
                    {getPageNumbers().map((page, idx) => (
                        <button
                            key={idx}
                            onClick={() => typeof page === 'number' && onPageChange(page)}
                            disabled={page === '...'}
                            className={cn(
                                'min-w-[32px] h-8 px-2 flex items-center justify-center rounded-lg text-sm font-medium',
                                page === currentPage
                                    ? 'bg-blue-500 text-white'
                                    : page === '...'
                                        ? 'text-gray-400 cursor-default'
                                        : 'bg-white border hover:bg-gray-50 text-gray-600'
                            )}
                        >
                            {page}
                        </button>
                    ))}

                    {/* Next button */}
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={cn(
                            'w-8 h-8 flex items-center justify-center rounded-lg border text-sm',
                            currentPage === totalPages
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-white hover:bg-gray-50 text-gray-600'
                        )}
                    >
                        ›
                    </button>
                </div>
            </div>
        </div>
    );
}

// Compact variant for smaller spaces
export function PaginationCompact({
    currentPage,
    totalPages,
    onPageChange
}: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-sm border rounded disabled:opacity-50"
            >
                ‹ Trước
            </button>
            <span className="text-sm text-gray-600">
                {currentPage} / {totalPages}
            </span>
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-sm border rounded disabled:opacity-50"
            >
                Sau ›
            </button>
        </div>
    );
}
