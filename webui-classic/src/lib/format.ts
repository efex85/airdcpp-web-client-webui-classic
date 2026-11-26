const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];

export const formatSize = (bytes: number | undefined): string => {
  if (bytes === undefined || bytes === null || bytes < 0) {
    return '';
  }

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${unit === 0 ? value : value.toFixed(2)} ${UNITS[unit]}`;
};

/** "1.5 KiB (1,536 B)" */
export const formatExactSize = (bytes: number | undefined): string => {
  const short = formatSize(bytes);
  return short && bytes! >= 1024 ? `${short} (${bytes!.toLocaleString('en-US')} B)` : short;
};

export const formatSpeed = (bytesPerSecond: number | undefined): string =>
  bytesPerSecond && bytesPerSecond > 0 ? `${formatSize(bytesPerSecond)}/s` : '';

export const formatDuration = (seconds: number | undefined): string => {
  if (!seconds || seconds < 0) {
    return '';
  }

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  return d ? `${d}d ${time}` : time;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

export const formatTime = (unix: number): string => {
  const d = new Date(unix * 1000);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

/** Timestamp of a chat or log line as chosen in the settings; empty if timestamps are hidden */
export const formatChatTime = (unix: number, style: string): string =>
  style === 'none' ? '' : style === 'minutes' ? formatTime(unix).slice(0, 5) : formatTime(unix);

/** "3 days 04:05:09" */
export const formatUptime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const time = [Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60), total % 60].map(pad2).join(':');
  return days ? `${days} ${days === 1 ? 'day' : 'days'} ${time}` : time;
};

/** "5 minutes ago" */
export const formatAge = (unix: number, now = Date.now() / 1000): string => {
  const seconds = Math.max(0, now - unix);
  const units: [name: string, length: number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [name, length] of units) {
    const count = Math.floor(seconds / length);
    if (count >= 1) {
      return `${count} ${name}${count === 1 ? '' : 's'} ago`;
    }
  }

  return 'just now';
};

export const formatDate = (unix: number | undefined): string => {
  if (!unix) {
    return '';
  }

  const d = new Date(unix * 1000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export const percent = (done: number, total: number): number =>
  total > 0 ? Math.min(100, Math.max(0, (done / total) * 100)) : 0;
