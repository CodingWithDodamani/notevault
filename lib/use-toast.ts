'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export interface Toast {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  duration?: number;
}

type ToastContextType = {
  toasts: Toast[];
  toast: (o: Omit<Toast, 'id'> & { id?: string }) => string;
  dismiss: (id?: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_LIMIT = 5;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (o: Omit<Toast, 'id'> & { id?: string }): string => {
      const id = o.id || Math.random().toString(36).slice(2, 11);
      setToasts((prev) => [{ ...o, id }, ...prev].slice(0, TOAST_LIMIT));
      return id;
    },
    []
  );

  const dismissToast = useCallback((id?: string) => {
    setToasts((prev) => (id ? prev.filter((t) => t.id !== id) : []));
  }, []);

  const ctxValue = { toasts: toasts, toast: showToast, dismiss: dismissToast };

  return React.createElement(
    ToastContext.Provider,
    { value: ctxValue },
    children
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export function useToastDismiss() {
  const { dismiss: dismissToast } = useToast();
  return dismissToast;
}

export function useToastAutoDismiss(id: string, duration?: number) {
  const { dismiss: dismissToast } = useToast();
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(id), duration ?? 5000);
    return () => clearTimeout(timer);
  }, [id, duration, dismissToast]);
}
