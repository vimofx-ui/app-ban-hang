import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value?: number | string;
    onValueChange?: (value: number) => void;
    className?: string;
}

export function CurrencyInput({ value, onValueChange, className, name, ...props }: CurrencyInputProps) {
    const [displayValue, setDisplayValue] = useState(() => {
        const initVal = value !== undefined ? value : props.defaultValue;
        if (initVal !== undefined && initVal !== null && initVal !== '') {
            let num: number;
            if (typeof initVal === 'number') {
                num = initVal;
            } else if (typeof initVal === 'string') {
                num = parseFloat(initVal);
            } else {
                num = NaN;
            }
            return !isNaN(num) ? num.toLocaleString('vi-VN') : '';
        }
        return '';
    });

    useEffect(() => {
        if (value !== undefined) {
            if (value === '' || value === null) {
                setDisplayValue('');
            } else {
                const numericValue = typeof value === 'string' ? parseFloat(value) : value;
                if (!isNaN(numericValue)) {
                    setDisplayValue(numericValue.toLocaleString('vi-VN'));
                }
            }
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const digits = raw.replace(/\D/g, '');

        if (digits === '') {
            setDisplayValue('');
            if (onValueChange) onValueChange(0);
            return;
        }

        const number = parseInt(digits, 10);
        setDisplayValue(number.toLocaleString('vi-VN'));
        if (onValueChange) onValueChange(number);
    };

    const getNumericValue = () => {
        if (!displayValue) return '';
        const digits = displayValue.replace(/\D/g, '');
        return digits === '' ? '' : parseInt(digits, 10);
    };

    return (
        <div className="relative w-full">
            {name && <input type="hidden" name={name} value={getNumericValue()} />}
            <input
                {...props}
                type="text"
                value={displayValue}
                onChange={handleChange}
                className={cn("text-right w-full", className)}
            />
        </div>
    );
}
