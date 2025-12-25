import { useState, useRef, useEffect } from 'react';

interface Item {
    id: string;
    name: string;
}

interface SelectWithCRUDProps {
    items: Item[];
    value: string;
    onChange: (value: string) => void;
    onAdd: (name: string) => void;
    onDelete: (id: string) => void;
    placeholder: string;
    label: string;
    addButtonText?: string;
}

export function SelectWithCRUD({
    items,
    value,
    onChange,
    onAdd,
    onDelete,
    placeholder,
    label,
    addButtonText = '+ Tạo mới'
}: SelectWithCRUDProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [showAddInput, setShowAddInput] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setShowAddInput(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedItem = items.find(i => i.id === value);

    const handleAdd = () => {
        if (newItemName.trim()) {
            onAdd(newItemName.trim());
            setNewItemName('');
            setShowAddInput(false);
        }
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Bạn có chắc muốn xóa mục này?')) {
            onDelete(id);
            if (value === id) onChange('');
        }
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
                {label}
            </label>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <span style={{ color: selectedItem ? '#374151' : '#9ca3af' }}>
                    {selectedItem?.name || placeholder}
                </span>
                <span style={{ color: '#9ca3af' }}>▾</span>
            </div>

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
                    maxHeight: '280px',
                    overflowY: 'auto'
                }}>
                    {/* Add new item */}
                    {showAddInput ? (
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder="Nhập tên mới..."
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                style={{
                                    flex: 1,
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    fontSize: '13px'
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleAdd}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#2563eb',
                                    color: 'white',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                }}
                            >
                                Thêm
                            </button>
                        </div>
                    ) : (
                        <div
                            onClick={() => setShowAddInput(true)}
                            style={{
                                padding: '10px 12px',
                                borderBottom: '1px solid #e5e7eb',
                                color: '#2563eb',
                                fontWeight: 500,
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            {addButtonText}
                        </div>
                    )}

                    {/* Empty option */}
                    <div
                        onClick={() => { onChange(''); setIsOpen(false); }}
                        style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            backgroundColor: !value ? '#f3f4f6' : 'transparent',
                            color: '#9ca3af',
                            fontSize: '14px'
                        }}
                    >
                        -- {placeholder} --
                    </div>

                    {/* Items list */}
                    {items.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => { onChange(item.id); setIsOpen(false); }}
                            style={{
                                padding: '10px 12px',
                                cursor: 'pointer',
                                backgroundColor: value === item.id ? '#eff6ff' : 'transparent',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '14px'
                            }}
                        >
                            <span>{item.name}</span>
                            <button
                                type="button"
                                onClick={(e) => handleDelete(item.id, e)}
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    opacity: 0.6,
                                    fontSize: '12px'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                                title="Xóa"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}

                    {items.length === 0 && (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                            Chưa có mục nào
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
