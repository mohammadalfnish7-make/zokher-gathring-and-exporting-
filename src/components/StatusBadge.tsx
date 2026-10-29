export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-pill status-${status}`}>{status.replace("_", " ")}</span>;
}
