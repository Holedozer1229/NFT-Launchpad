export function StatCardSkeleton() {
  return (
    <div className="cosmic-card p-5 animate-pulse" data-testid="skeleton-stat-card">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-3 w-24 rounded bg-white/5" data-testid="skeleton-stat-label" />
          <div className="h-7 w-32 rounded bg-white/10" data-testid="skeleton-stat-value" />
        </div>
        <div className="w-9 h-9 rounded-sm bg-white/5" data-testid="skeleton-stat-icon" />
      </div>
      <div className="flex items-center gap-1 mt-3">
        <div className="h-3 w-3 rounded-full bg-white/5" />
        <div className="h-3 w-28 rounded bg-white/5" data-testid="skeleton-stat-change" />
      </div>
    </div>
  );
}

export function NFTCardSkeleton() {
  return (
    <div className="cosmic-card animate-pulse" data-testid="skeleton-nft-card">
      <div className="aspect-square bg-white/5" data-testid="skeleton-nft-image" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 rounded bg-white/10" data-testid="skeleton-nft-title" />
        <div className="flex justify-between items-center">
          <div className="h-3 w-20 rounded bg-white/5" data-testid="skeleton-nft-token" />
          <div className="h-3 w-16 rounded bg-white/10" data-testid="skeleton-nft-price" />
        </div>
        <div className="flex gap-2">
          <div className="h-5 w-14 rounded-full bg-white/5" data-testid="skeleton-nft-badge-1" />
          <div className="h-5 w-16 rounded-full bg-white/5" data-testid="skeleton-nft-badge-2" />
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-white/5">
          <div className="h-3 w-20 rounded bg-white/5" />
          <div className="h-3 w-16 rounded bg-white/5" />
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="cosmic-card p-5 animate-pulse" data-testid="skeleton-chart">
      <div className="h-3 w-48 rounded bg-white/5 mb-4" data-testid="skeleton-chart-label" />
      <div className="h-[250px] rounded bg-white/5 relative overflow-hidden" data-testid="skeleton-chart-area">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="animate-pulse" data-testid="skeleton-table-row">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <div
            className={`h-3 rounded ${i === 0 ? "w-28 bg-white/10" : "w-20 bg-white/5"}`}
            data-testid={`skeleton-table-cell-${i}`}
          />
        </td>
      ))}
    </tr>
  );
}
