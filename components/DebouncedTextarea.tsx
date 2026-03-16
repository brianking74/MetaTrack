
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
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (value !== lastValueRef.current) {
      setLocalValue(value);
      lastValueRef.current = value;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);
    lastValueRef.current = newVal;
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChange(newVal);
      timeoutRef.current = null;
    }, 500);
  };

  const handleBlur = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      onChange(localValue);
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
