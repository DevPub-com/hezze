const archivePostedAtFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatArchivePostedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "시간 미상";
  return archivePostedAtFormatter.format(date);
}
