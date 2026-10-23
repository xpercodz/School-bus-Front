import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ToastItem {
  id: number;
  message: string;
  leaving?: boolean;
}

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** How long a toast stays fully visible before it starts leaving. */
const VISIBLE_MS = 2800;
/** Exit duration; matches the .toast-out keyframe in globals.css. */
const EXIT_MS = 160;

/**
 * Lightweight app-wide toast feedback. Callers pass already-translated strings
 * (translation happens at the call site where `t` is available). Toasts render
 * bottom-center above everything (z-100), above the mobile action bar, and
 * auto-dismiss after ~3s.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev.slice(-2), { id, message }]);

    // Mark it leaving first so the CSS exit can run, then unmount it.
    window.setTimeout(() => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, leaving: true } : item)),
      );
    }, VISIBLE_MS);

    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, VISIBLE_MS + EXIT_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto max-w-sm rounded-xl bg-on-surface px-4 py-2.5 text-[13px] leading-5 text-surface shadow-float ${
              item.leaving ? "toast-out" : "toast-in"
            }`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
