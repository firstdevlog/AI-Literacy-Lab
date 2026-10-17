import { ArrowRight, BookOpen, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children && <div className="muted page-description">{children}</div>}
      </div>
      {action}
    </div>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={26} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function StartLink({
  children = "학습 시작",
  className = "button primary",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Link className={className} to="/stage/1">
      <BookOpen size={17} />
      {children}
      <ArrowRight size={16} />
    </Link>
  );
}
export function Score({ value }: { value: number | null }) {
  return (
    <>
      {value === null
        ? "—"
        : Number.isInteger(value)
          ? value
          : value.toFixed(1)}
      {value !== null && <small>점</small>}
    </>
  );
}
