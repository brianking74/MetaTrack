
import React, { useState, useRef, useEffect } from 'react';

interface DebouncedTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

const DebouncedTextarea: React.FC<DebouncedTextareaProps> = ({ 
  value, 
  onChange, 
  placeholder, 
  className, 
  disabled,
  readOnly 
}) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep the latest onChange in a ref to avoid stale closures in the timeout
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync local value with prop value when it changes externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChangeRef.current(newVal);
      timeoutRef.current = null;
    }, 300);
  };

  const handleBlur = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      onChangeRef.current(localValue);
    }
  };

  return (
    <textarea
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      readOnly={readOnly}
    />
  );
};

export default DebouncedTextarea;
