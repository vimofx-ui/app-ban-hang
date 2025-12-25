// Unit Suggest Dropdown Component
// Provides a dropdown with common unit suggestions + custom input option

import { useState, useRef, useEffect } from 'react';

// Predefined unit suggestions in order
const SUGGESTED_UNITS = [
    'Chiếc',
    'Chai',
    'Lọ',
    'Lốc',
    'Vỉ',
    'Thùng',
    'Hộp',
    'Combo',
    'Khay',
];

interface UnitSuggestDropdownProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function UnitSuggestDropdown({ value, onChange, placeholder = 'Chọn đơn vị', className }: UnitSuggestDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCustom, setIsCustom] = useState(false);
    const [customValue, setCustomValue] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Check if value is one of the suggested units
    const isPresetUnit = SUGGESTED_UNITS.some(u => u.toLowerCase() === value.toLowerCase());

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setIsCustom(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus custom input when opening
    useEffect(() => {
        if (isCustom && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isCustom]);

    const handleSelect = (unit: string) => {
        onChange(unit);
        setIsOpen(false);
        setIsCustom(false);
    };

    const handleCustomSubmit = () => {
        if (customValue.trim()) {
            onChange(customValue.trim());
            setCustomValue('');
            setIsOpen(false);
            setIsCustom(false);
        }
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }} className={className}>
            {/* Display button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <span style={{ color: value ? '#111827' : '#9ca3af' }}>
                    {value || placeholder}
                </span>
                <span style={{ fontSize: '10px', color: '#6b7280' }}>
                    {isOpen ? '▲' : '▼'}
                </span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}>
                    {/* Suggested units */}
                    {SUGGESTED_UNITS.map((unit, idx) => (
                        <div
                            key={idx}
                            onClick={() => handleSelect(unit)}
                            style={{
                                padding: '10px 16px',
                                cursor: 'pointer',
                                backgroundColor: value.toLowerCase() === unit.toLowerCase() ? '#dbeafe' : 'transparent',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: idx < SUGGESTED_UNITS.length - 1 ? '1px solid #f3f4f6' : 'none'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = value.toLowerCase() === unit.toLowerCase() ? '#dbeafe' : '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = value.toLowerCase() === unit.toLowerCase() ? '#dbeafe' : 'transparent'}
                        >
                            <span style={{ fontSize: '14px' }}>{unit}</span>
                            {value.toLowerCase() === unit.toLowerCase() && (
                                <span style={{ color: '#3b82f6', fontWeight: 600 }}>✓</span>
                            )}
                        </div>
                    ))}

                    {/* Divider */}
                    <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

                    {/* Custom option */}
                    {!isCustom ? (
                        <div
                            onClick={() => setIsCustom(true)}
                            style={{
                                padding: '10px 16px',
                                cursor: 'pointer',
                                backgroundColor: !isPresetUnit && value ? '#fef3c7' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#2563eb'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = !isPresetUnit && value ? '#fef3c7' : 'transparent'}
                        >
                            <span>➕</span>
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>Tạo mới</span>
                            {!isPresetUnit && value && (
                                <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#6b7280' }}>
                                    (hiện tại: {value})
                                </span>
                            )}
                        </div>
                    ) : (
                        <div style={{ padding: '10px 16px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={customValue}
                                    onChange={(e) => setCustomValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleCustomSubmit();
                                        }
                                        if (e.key === 'Escape') {
                                            setIsCustom(false);
                                        }
                                    }}
                                    placeholder="Nhập đơn vị mới..."
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '14px'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleCustomSubmit}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Thêm
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
