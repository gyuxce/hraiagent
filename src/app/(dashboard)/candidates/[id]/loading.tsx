export default function CandidateDetailLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <div className="h-4 w-40 rounded bg-mist-deep" />
      <div>
        <div className="h-3 w-28 rounded bg-mist-deep" />
        <div className="mt-3 h-9 w-64 max-w-full rounded bg-mist-deep" />
        <div className="mt-2 h-4 w-80 max-w-full rounded bg-mist-deep/80" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-panel h-72 p-5" />
        <div className="surface-panel h-72 p-5" />
      </div>
      <div className="surface-panel h-48 p-5" />
      <p className="text-center text-xs text-muted">Memuat detail kandidat...</p>
    </div>
  );
}
