import { useRef } from 'react';
import { cn } from '@/lib/utils';
import type { OrderTab } from '@/types/pos';

interface POSTabsProps {
    tabs: OrderTab[];
    activeTabIndex: number;
    onSwitchTab: (index: number) => void;
    onCloseTab: (index: number) => void;
    onAddTab: () => void;
}

export const POSTabs = ({ tabs, activeTabIndex, onSwitchTab, onCloseTab, onAddTab }: POSTabsProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const scroll = (offset: number) => {
        if (containerRef.current) {
            containerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
        }
    };

    return (
        <div className="hidden md:flex items-center gap-1 flex-1 min-w-0">
            {/* Left Scroll Button */}
            {tabs.length > 3 && (
                <button
                    onClick={() => scroll(-80)}
                    className="w-6 h-6 bg-white/20 hover:bg-white/30 rounded text-white flex items-center justify-center flex-shrink-0"
                >
                    ‹
                </button>
            )}

            {/* Scrollable Tab Container */}
            <div
                ref={containerRef}
                className="flex items-center gap-1 overflow-x-auto flex-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {tabs.map((tab, index) => (
                    <div key={tab.id} className="relative group flex-shrink-0">
                        <button
                            onClick={() => onSwitchTab(index)}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                                activeTabIndex === index ? 'bg-white text-green-600' : 'bg-white/20 hover:bg-white/30'
                            )}
                        >
                            Đơn {tab.id}
                        </button>
                        {tabs.length > 1 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onCloseTab(index); }}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                                ×
                            </button>
                        )}
                    </div>
                ))}
                {/* Add Tab Button */}
                <button
                    onClick={onAddTab}
                    className="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-lg text-lg font-bold flex-shrink-0 flex items-center justify-center"
                >
                    +
                </button>
            </div>

            {/* Right Scroll Button */}
            {tabs.length > 3 && (
                <button
                    onClick={() => scroll(80)}
                    className="w-6 h-6 bg-white/20 hover:bg-white/30 rounded text-white flex items-center justify-center flex-shrink-0"
                >
                    ›
                </button>
            )}
        </div>
    );
};
