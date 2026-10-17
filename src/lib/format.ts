export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}
export function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}분 ${Math.floor(seconds % 60)}초`;
}
