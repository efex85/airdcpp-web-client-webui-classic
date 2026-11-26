import { ArrowDown, ArrowUp, Moon } from 'lucide-react';
import { showWindow } from '../actions';
import { toggleAway } from '../actions/mainMenu';
import { formatSize, formatTime } from '../lib/format';
import { useApp } from '../store/app';

const speed = (value: number | undefined) => `${formatSize(value ?? 0)}/s`;

export const StatusBar = () => {
  const lastEvent = useApp((s) => s.lastEvent);
  const stats = useApp((s) => s.stats);
  const hubs = useApp((s) => s.hubs);
  const shareSize = useApp((s) => s.shareSize);
  const away = useApp((s) => s.away);
  const connected = hubs.filter((h) => h.connect_state.id === 'connected').length;

  return (
    <footer className="statusbar">
      <button type="button" className="status-log grow" title={lastEvent?.text} onClick={() => showWindow('syslog')}>
        {lastEvent && `[${formatTime(lastEvent.time)}] ${lastEvent.text}`}
      </button>
      {away && (
        <button type="button" className="status-away" title="Away mode is on" onClick={() => void toggleAway()}>
          <Moon size={11} /> Away
        </button>
      )}
      {shareSize !== null && <span className="wide">Shared: {formatSize(shareSize)}</span>}
      <span className="wide" title="Connected / open hubs">
        Hubs: {connected}/{hubs.length}
      </span>
      <span className="wide" title="Downloaded during this session">
        Down: {formatSize(stats.session_downloaded ?? 0)}
      </span>
      <span className="wide" title="Uploaded during this session">
        Up: {formatSize(stats.session_uploaded ?? 0)}
      </span>
      <span title={`Download speed, ${stats.downloads ?? 0} running`}>
        <ArrowDown size={11} className="i-down" /> {speed(stats.speed_down)}
      </span>
      <span title={`Upload speed, ${stats.uploads ?? 0} running`}>
        <ArrowUp size={11} className="i-up" /> {speed(stats.speed_up)}
      </span>
      <span className="wide">Queued: {formatSize(stats.queued_bytes ?? 0)}</span>
    </footer>
  );
};
