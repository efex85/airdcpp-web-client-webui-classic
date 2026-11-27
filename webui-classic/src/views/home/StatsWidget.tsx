// Uptime, transfers, share, hashing and disk space
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useAccess } from '../../lib/access';
import { formatSize, formatUptime } from '../../lib/format';
import { useApp } from '../../store/app';
import { socket } from '../../store/session';
import { DiskStats } from './DiskStats';
import { HashingStats } from './HashingStats';

interface Transferred {
  session_downloaded: number;
  session_uploaded: number;
  start_total_downloaded: number;
  start_total_uploaded: number;
}

/** The current time in seconds, updated every second while the window is shown */
export const useNow = (active: boolean, interval = 1000) => {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    if (!active) {
      return;
    }

    setNow(Date.now() / 1000);
    const timer = setInterval(() => setNow(Date.now() / 1000), interval);
    return () => clearInterval(timer);
  }, [active, interval]);
  return now;
};

const TOTALS_INTERVAL = 5000;

const ratio = (uploaded: number, downloaded: number) => (downloaded > 0 ? (uploaded / downloaded).toFixed(2) : '–');

const Row = ({ title, children }: { title: string; children: ReactNode }) => (
  <tr>
    <th scope="row">{title}</th>
    {children}
  </tr>
);

export const StatsWidget = ({ active }: { active: boolean }) => {
  const access = useAccess();
  const system = useApp((s) => s.login?.system_info);
  const stats = useApp((s) => s.stats);
  const hubs = useApp((s) => s.hubs);
  const shareSize = useApp((s) => s.shareSize);
  const generation = useApp((s) => s.generation);
  const now = useNow(active);
  const [transferred, setTransferred] = useState<Transferred | null>(null);
  const transfers = access('transfers');

  // The totals aren't part of the statistics events
  useEffect(() => {
    if (!transfers || !active) {
      return;
    }

    const load = () =>
      void socket.get<Transferred>('transfers/transferred_bytes').then(setTransferred, () => undefined);
    load();
    const timer = setInterval(load, TOTALS_INTERVAL);
    return () => clearInterval(timer);
  }, [transfers, generation, active]);

  const sessionDown = stats.session_downloaded ?? transferred?.session_downloaded ?? 0;
  const sessionUp = stats.session_uploaded ?? transferred?.session_uploaded ?? 0;
  // The totals from before this run of the client plus this run, both from the same response
  const totalDown = transferred && transferred.start_total_downloaded + transferred.session_downloaded;
  const totalUp = transferred && transferred.start_total_uploaded + transferred.session_uploaded;
  const uptime = (started: number | undefined) => (started ? formatUptime(now - started) : '');

  return (
    <div className="home-stats">
      <table>
        <tbody>
          {!!system?.system_started && (
            <Row title="System uptime">
              <td colSpan={2} data-stat="system-uptime">
                {uptime(system.system_started)}
              </td>
            </Row>
          )}
          <Row title="Client uptime">
            <td colSpan={2} data-stat="client-uptime">
              {uptime(system?.client_started)}
            </td>
          </Row>
        </tbody>
      </table>
      {transfers ? (
        <table>
          <thead>
            <tr>
              <td />
              <th scope="col">
                <ArrowDown size={12} className="i-down" /> Download
              </th>
              <th scope="col">
                <ArrowUp size={12} className="i-up" /> Upload
              </th>
            </tr>
          </thead>
          <tbody>
            <Row title="Speed">
              <td data-stat="speed-down">{formatSize(stats.speed_down ?? 0)}/s</td>
              <td data-stat="speed-up">{formatSize(stats.speed_up ?? 0)}/s</td>
            </Row>
            <Row title="Running">
              <td>{stats.downloads ?? 0}</td>
              <td>{stats.uploads ?? 0}</td>
            </Row>
            <Row title="This session">
              <td data-stat="session-down">{formatSize(sessionDown)}</td>
              <td data-stat="session-up">{formatSize(sessionUp)}</td>
            </Row>
            <Row title="Total">
              <td data-stat="total-down">{totalDown === null ? '' : formatSize(totalDown)}</td>
              <td data-stat="total-up">{totalUp === null ? '' : formatSize(totalUp)}</td>
            </Row>
            <Row title="Ratio (ul/dl)">
              <td colSpan={2} data-stat="ratio">
                <span>{ratio(sessionUp, sessionDown)} session</span>
                {totalDown !== null && (
                  <>
                    {' · '}
                    <span>{ratio(totalUp!, totalDown)} total</span>
                  </>
                )}
              </td>
            </Row>
            <Row title="Download queue">
              <td colSpan={2} data-stat="queue">
                {formatSize(stats.queued_bytes ?? 0)}
              </td>
            </Row>
          </tbody>
        </table>
      ) : (
        <p className="muted">You don't have permission to see the transfer statistics.</p>
      )}
      {(access('hubs_view') || shareSize !== null) && (
        <table>
          <tbody>
            {access('hubs_view') && (
              <Row title="Hubs connected">
                <td>
                  {hubs.filter((h) => h.connect_state.id === 'connected').length} of {hubs.length}
                </td>
              </Row>
            )}
            {shareSize !== null && (
              <Row title="Shared">
                <td>{formatSize(shareSize)}</td>
              </Row>
            )}
          </tbody>
        </table>
      )}
      {access('share_view') && <HashingStats active={active} />}
      <DiskStats active={active} />
    </div>
  );
};
