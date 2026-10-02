import type { ReactNode } from 'react';

interface ErrorBannerProps {
  message: string;
  actions?: ReactNode;
}

export function ErrorBanner({ message, actions }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert" data-testid="error-banner">
      <p className="error-banner__message">{message}</p>
      {actions && <div className="error-banner__actions">{actions}</div>}
    </div>
  );
}
