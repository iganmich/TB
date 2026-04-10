interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <div className={`bg-bg-card border border-border rounded-lg p-4 ${className}`}>
      {title && (
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
