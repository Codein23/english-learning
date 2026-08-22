export function PageTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold lg:text-3xl">{title}</h1>
      {description ? (
        <p className="prose-measure text-base text-muted">{description}</p>
      ) : null}
    </div>
  );
}
