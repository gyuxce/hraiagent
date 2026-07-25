import type { ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  stepLabel?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, stepLabel, action }: Props) {
  return (
    <div className="px-6 py-14 text-center sm:py-16">
      {stepLabel && (
        <p className="page-kicker mx-auto mb-3 inline-block">{stepLabel}</p>
      )}
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{description}</p>
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  );
}
