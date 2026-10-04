import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'lg',
}) => {
  const { playHapticClick } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-900/60 dark:bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Content */}
      <div
        className={`relative w-full ${widthClasses[maxWidth]} bg-white dark:bg-ink-800 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-700/80 shadow-floating p-4 sm:p-6 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200`}
      >
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="text-lg font-extrabold text-ink-900 dark:text-white tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={() => {
              playHapticClick();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-ink-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ink-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="pt-4 max-h-[75vh] overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
};
