import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export function Card({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn('bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="text-[28px] font-extrabold text-slate-900 mt-2 leading-none">{value}</div>
          {hint && <div className="mt-3 text-xs text-slate-500">{hint}</div>}
        </div>
        {icon && (
          <div className={cn('size-10 rounded-xl flex items-center justify-center', accent ?? 'bg-violet-50 text-[#6c1d95]')}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', className)}>
      {children}
    </span>
  );
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50',
        variant === 'primary' && 'bg-[#6c1d95] text-white hover:bg-[#5a187c]',
        variant === 'secondary' && 'bg-slate-100 text-slate-700 hover:bg-slate-200',
        variant === 'ghost' && 'bg-violet-50 text-[#6c1d95] hover:bg-violet-100',
        variant === 'danger' && 'bg-rose-50 text-rose-700 hover:bg-rose-100',
        className,
      )}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#6c1d95] focus:ring-2 focus:ring-[#6c1d95]/20',
        props.className,
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#6c1d95] focus:ring-2 focus:ring-[#6c1d95]/20',
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#6c1d95] focus:ring-2 focus:ring-[#6c1d95]/20',
        props.className,
      )}
    />
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <Card className="p-10 text-center">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      {body && <p className="text-sm text-slate-500 mt-1">{body}</p>}
    </Card>
  );
}

export function LoadingBlock() {
  return (
    <div className="grid place-items-center py-20 text-sm text-slate-500">Loading…</div>
  );
}

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className="border-b border-slate-100">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
