import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { cn } from "@/src/lib/utils";

export type ConfirmVariant = "default" | "destructive";

export type ConfirmOptions = {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
};

type ConfirmRequest = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  /** Radix closes the dialog before Action onClick; skip the dismiss handler when confirming. */
  const confirmingRef = useRef(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    confirmingRef.current = false;
    return new Promise<boolean>((resolve) => {
      setRequest({ ...options, resolve });
    });
  }, []);

  const close = useCallback((confirmed: boolean) => {
    setRequest((current) => {
      if (!current) return null;
      current.resolve(confirmed);
      return null;
    });
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      if (confirmingRef.current) {
        confirmingRef.current = false;
        return;
      }
      close(false);
    },
    [close],
  );

  const value = useMemo(() => ({ confirm }), [confirm]);

  const destructive = request?.variant === "destructive";

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AlertDialog open={!!request} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            {request?.description ? (
              <AlertDialogDescription asChild>
                <div>{request.description}</div>
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>
              {request?.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                destructive &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive",
              )}
              onClick={() => {
                confirmingRef.current = true;
                close(true);
              }}
            >
              {request?.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx.confirm;
}
