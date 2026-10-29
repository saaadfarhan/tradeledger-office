export function FormSectionHeading({
  title,
  description,
  className = "col-span-full",
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={`border-b pb-2 ${className}`}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
