import type { ReactNode } from "react";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Card, CardContent } from "@/src/components/ui/card";

interface LoadingStateProps {
  message?: string;
  variant?: "page" | "inline" | "skeleton";
  rows?: number;
}

export function LoadingState({ message = "Loading…", variant = "page", rows = 3 }: LoadingStateProps) {
  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        <span className="text-sm font-medium">{message}</span>
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div className="space-y-4" role="status" aria-live="polite" aria-label={message}>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: rows }).map((_, n) => (
            <Card key={n}>
              <CardContent className="space-y-3 pt-6">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" role="status" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  action?: ReactNode;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this content. Please try again.",
  onRetry,
  action,
}: ErrorStateProps) {
  return (
    <Card className="mx-auto max-w-md text-center" role="alert">
      <CardContent className="pt-6">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" aria-hidden />
        <h2 className="text-base font-bold">{title}</h2>
        <p className="mt-1.5 text-xs text-muted-foreground">{message}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <Button type="button" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
          {action}
        </div>
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="mx-auto flex max-w-lg flex-col items-center justify-center px-6 py-12 text-center">
      <CardContent className="flex flex-col items-center pt-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border bg-muted text-muted-foreground">
          {icon ?? <Inbox className="h-6 w-6" aria-hidden />}
        </div>
        <h3 className="text-base font-bold">{title}</h3>
        {description && <p className="mt-1.5 max-w-xs text-xs text-muted-foreground">{description}</p>}
        {action && <div className="mt-6">{action}</div>}
      </CardContent>
    </Card>
  );
}

interface QueryStateProps<T> {
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  data: T | undefined;
  loadingMessage?: string;
  loadingVariant?: LoadingStateProps["variant"];
  errorTitle?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  emptyIcon?: ReactNode;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}

export function QueryState<T>({
  isLoading,
  isError,
  error,
  data,
  loadingMessage,
  loadingVariant = "page",
  errorTitle,
  empty,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  emptyIcon,
  onRetry,
  children,
}: QueryStateProps<T>) {
  if (isLoading) {
    return <LoadingState message={loadingMessage} variant={loadingVariant} />;
  }

  if (isError) {
    return <ErrorState title={errorTitle} message={error?.message} onRetry={onRetry} />;
  }

  if (data === undefined) {
    return <LoadingState message={loadingMessage} variant="inline" />;
  }

  if (empty) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return <>{children(data)}</>;
}
