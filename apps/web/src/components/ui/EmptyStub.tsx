import type { ReactNode } from "react";

interface Props {
  step: string;
  hint: string;
  children?: ReactNode;
}

export function EmptyStub({ step, hint, children }: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-base font-semibold">{step}</h2>
        <span className="pill-info">Coming soon</span>
      </div>
      <div className="card-body">
        <p className="text-sm text-slate-400">{hint}</p>
        {children}
      </div>
    </div>
  );
}
