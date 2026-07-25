export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
      <div>
        <div className="h-3 w-24 rounded bg-mist-deep" />
        <div className="mt-3 h-8 w-56 rounded bg-mist-deep" />
        <div className="mt-2 h-4 w-80 max-w-full rounded bg-mist-deep/80" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface-panel h-24 p-5">
            <div className="h-3 w-20 rounded bg-mist-deep" />
            <div className="mt-4 h-8 w-16 rounded bg-mist-deep" />
          </div>
        ))}
      </div>
      <div className="surface-panel h-64 p-5">
        <div className="h-4 w-40 rounded bg-mist-deep" />
        <div className="mt-6 space-y-3">
          <div className="h-3 w-full rounded bg-mist-deep/80" />
          <div className="h-3 w-5/6 rounded bg-mist-deep/70" />
          <div className="h-3 w-4/6 rounded bg-mist-deep/60" />
        </div>
      </div>
      <p className="text-center text-xs text-muted">Memuat...</p>
    </div>
  );
}
