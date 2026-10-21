import type { ReactNode } from "react";

interface PageHeaderProps {
  /** The screen's one h1 — a noun, not a greeting. */
  title: string;
  /** Scope and period, in one quiet line. */
  subtitle?: ReactNode;
  /** The one fact that needs attention today. */
  finding?: string;
  /** Real actions only, bottom-aligned with the title block. */
  actions?: ReactNode;
}

/**
 * Canvas title row shared by every director screen: an h1, one scope line, the
 * finding, and the screen's real actions. It gives every page the same left
 * edge and keeps the largest figure below it, where the data is.
 */
export function PageHeader({ title, subtitle, finding, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 pt-1 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-dash-headline-lg text-dash-on-surface">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-[13.5px] leading-5 text-dash-on-surface-variant">
            {subtitle}
          </p>
        )}
        {finding && (
          <p className="mt-2 flex items-start gap-2 text-[13.5px] font-medium leading-5 text-dash-on-surface">
            <span
              className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-dash-primary"
              aria-hidden="true"
            />
            <span>{finding}</span>
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
