import { useState, useRef, useEffect } from 'react';

interface Item {
    id: string;
    name: string;
}

interface MultiCategorySelectProps {
    items: Item[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    onAdd: (name: string) => void;
    onDelete: (id: string) => void;
    placeholder?: string;
    label: string;
}

export function MultiCategorySelect({
    items,
    selectedIds,
    onChange,
    onAdd,
    onDelete,
    placeholder = 'Chọn danh mục',
    label
}: MultiCategorySelectProps) {
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

    const selectedItems = items.filter(i => selectedIds.includes(i.id));

    const handleToggle = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(sid => sid !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const handleRemoveTag = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(selectedIds.filter(sid => sid !== id));
    };

    const handleAdd = () => {
        if (newItemName.trim()) {
            onAdd(newItemName.trim());
            setNewItemName('');
            setShowAddInput(false);
        }
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Bạn có chắc muốn xóa danh mục này?')) {
            onDelete(id);
            onChange(selectedIds.filter(sid => sid !== id));
        }
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
                {label} <span style={{ color: '#9ca3af' }}>ⓘ</span>
            </label>

            {/* Selected tags */}
            {selectedItems.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {selectedItems.map(item => (
                        <span
                            key={item.id}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                backgroundColor: '#dbeafe',
                                color: '#1e40af',
                                borderRadius: '16px',
                                fontSize: '13px',
                                fontWeight: 500
                            }}
                        >
                            {item.name}
                            <button
                                type="button"
                                onClick={(e) => handleRemoveTag(item.id, e)}
                                style={{
                                    padding: '0 2px',
                                    border: 'none',
                                    background: 'none',
                                    color: '#1e40af',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    lineHeight: 1
                                }}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Dropdown trigger */}
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
                <span style={{ color: '#9ca3af' }}>
                    {selectedIds.length > 0 ? `Đã chọn ${selectedIds.length} danh mục` : placeholder}
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
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}>
                    {/* Add new item */}
                    {showAddInput ? (
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder="Nhập tên danh mục mới..."
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
                            + Tạo mới
                        </div>
                    )}

                    {/* Items list with checkboxes */}
                    {items.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                padding: '10px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '14px',
                                cursor: 'pointer',
                                backgroundColor: selectedIds.includes(item.id) ? '#f0fdf4' : 'transparent'
                            }}
                        >
                            <label
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}
                                onClick={(e) => { e.stopPropagation(); handleToggle(item.id); }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(item.id)}
                                    onChange={() => handleToggle(item.id)}
                                    style={{ width: '16px', height: '16px', accentColor: '#22c55e' }}
                                />
                                <span>{item.name}</span>
                            </label>
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
                                title="Xóa danh mục"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}

                    {items.length === 0 && (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                            Chưa có danh mục nào
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
