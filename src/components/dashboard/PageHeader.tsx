import type { ReactNode } from "react";

interface PageHeaderProps {
  /** The screen's one h1 — a noun, not a greeting. */
  title: string;
  /** Scope and period, in one quiet line. */
  subtitle?: ReactNode;
  /** The one fact that needs attention today. */
  finding?: string;
  /**
   * How loud that fact is. `"attention"` marks an exception someone has to
   * answer for (a run signed off with children unrecorded); the routine
   * "still to account for" line stays `"info"`, so the warning hue is never
   * spent on the normal mid-run state.
   */
  findingTone?: "info" | "attention";
  /** Real actions only, bottom-aligned with the title block. */
  actions?: ReactNode;
}

/**
 * Canvas title row shared by every director screen: an h1, one scope line, the
 * finding, and the screen's real actions. It gives every page the same left
 * edge and keeps the largest figure below it, where the data is.
 *
 * Phone: the title block is never squeezed sideways — actions always get their
 * own row, each at least 44px tall and growing to share the width (they wrap,
 * not shrink). From lg the two blocks return to one baseline row.
 */
export function PageHeader({
  title,
  subtitle,
  finding,
  findingTone = "info",
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 pt-1 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
      <div data-page-reveal className="min-w-0">
        <h1 className="text-dash-headline-lg text-dash-on-surface">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-[13px] leading-5 text-dash-on-surface-variant sm:text-[13.5px]">
            {subtitle}
          </p>
        )}
        {finding && (
          <p className="mt-2 flex items-start gap-2 text-[13px] font-medium leading-5 text-dash-on-surface sm:text-[13.5px]">
            <span
              className={`mt-[7px] h-1.5 w-1.5 flex-none rounded-full ${
                findingTone === "attention" ? "bg-dash-warning" : "bg-dash-primary"
              }`}
              aria-hidden="true"
            />
            <span className="min-w-0">{finding}</span>
          </p>
        )}
      </div>
      {actions && (
        <div
          data-tour="actions"
          className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-none [&>*]:min-h-11 [&>*]:flex-1 [&>*]:basis-32 [&>*]:whitespace-nowrap sm:[&>*]:min-h-0 sm:[&>*]:flex-none sm:[&>*]:basis-auto"
        >
          {actions}
        </div>
      )}
    </header>
  );
}
