export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="container grid min-h-[70dvh] place-items-center py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-3xl font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
    </div>
  );
}
