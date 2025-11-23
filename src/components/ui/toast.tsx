import * as React from 'react';
import { cn } from '@/lib/utils';

interface Toast {
    id: string;
    title?: string;
    description?: string;
}

interface ToastContextProps {
    addToast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = React.createContext<ToastContextProps | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
    const context = React.useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return React.useMemo(() => ({
        toast: context.addToast,
    }), [context.addToast]);
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = React.useState<Toast[]>([]);

    const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Date.now().toString();
        setToasts((prev) => {
            // Limit to max 3 toasts to prevent flooding
            const newToasts = [...prev, { id, ...toast }];
            if (newToasts.length > 3) {
                return newToasts.slice(newToasts.length - 3);
            }
            return newToasts;
        });

        // Auto remove after 3 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    const contextValue = React.useMemo(() => ({ addToast }), [addToast]);

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            {/* Toast container */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none items-center">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={cn(
                            'bg-primary text-primary-foreground rounded-md shadow-lg p-4 min-w-[250px] pointer-events-auto animate-in fade-in slide-in-from-bottom-5 duration-300',
                            'border border-primary/20',
                        )}
                    >
                        {t.title && <div className="font-medium">{t.title}</div>}
                        {t.description && (
                            <div className={cn("text-sm opacity-90", t.title && "mt-1")}>
                                {t.description}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
