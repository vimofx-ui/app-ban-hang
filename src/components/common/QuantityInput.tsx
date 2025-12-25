import React from 'react';
import { cn } from '@/lib/utils';

interface QuantityInputStyledProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    disabled?: boolean;
    className?: string;
}

export function QuantityInputStyled({
    value,
    onChange,
    min = 0,
    max = 99999,
    disabled = false,
    className,
}: QuantityInputStyledProps) {
    const handleDecrement = () => {
        if (value > min && !disabled) {
            onChange(value - 1);
        }
    };

    const handleIncrement = () => {
        if (value < max && !disabled) {
            onChange(value + 1);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value, 10);
        if (!isNaN(newValue) && newValue >= min && newValue <= max) {
            onChange(newValue);
        } else if (e.target.value === '') {
            onChange(min);
        }
    };

    return (
        <div className={cn(
            "flex items-center gap-1",
            disabled && "opacity-50",
            className
        )}>
            <button
                type="button"
                onClick={handleDecrement}
                disabled={disabled || value <= min}
                style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: disabled || value <= min ? '#e5e7eb' : '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: disabled || value <= min ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    color: disabled || value <= min ? '#9ca3af' : '#374151',
                }}
            >
                −
            </button>
            <input
                type="number"
                value={value}
                onChange={handleChange}
                disabled={disabled}
                min={min}
                max={max}
                style={{
                    width: '50px',
                    height: '32px',
                    textAlign: 'center',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    backgroundColor: disabled ? '#f3f4f6' : 'white',
                }}
            />
            <button
                type="button"
                onClick={handleIncrement}
                disabled={disabled || value >= max}
                style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: disabled || value >= max ? '#e5e7eb' : '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: disabled || value >= max ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    color: disabled || value >= max ? '#9ca3af' : '#374151',
                }}
            >
                +
            </button>
        </div>
    );
}

export default QuantityInputStyled;
