// Hashing in the System information widget
import { Pause, Play, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HashStats } from '../../api/settingsTypes';
import { Progress } from '../../components/Progress';
import { useAccess } from '../../lib/access';
import { hashingBusy, hashingProgress, hashingStatus, hashingText } from '../../lib/hashing';
import { useHeld } from '../../lib/useSelecting';
import { reportError, useApp } from '../../store/app';
import { socket } from '../../store/session';
import { confirm } from '../../store/ui';

const INTERVAL = 2000;

const load = (done: (stats: HashStats) => void) =>
  socket.get<HashStats>('hash/stats').then(done, () => undefined);

export const HashingStats = ({ active, held }: { active: boolean; held: boolean }) => {
  const access = useAccess();
  const generation = useApp((s) => s.generation);
  const [stats, setStats] = useState<HashStats | null>(null);

  // The text may stand still; the buttons always follow the client
  const shown = useHeld(stats, held);

  useEffect(() => {
    if (!active) {
      return;
    }

    void load(setStats);
    const timer = setInterval(() => void load(setStats), INTERVAL);
    return () => clearInterval(timer);
  }, [active, generation]);

  if (!stats || !shown) {
    return null;
  }

  const control = (action: 'pause' | 'resume' | 'stop') =>
    socket.post(`hash/${action}`).then(() => load(setStats), reportError('Hashing'));

  const stop = async () => {
    const text = 'Remove the waiting files from the hashing queue? A later share refresh adds them again.';
    if (await confirm('Stop hashing', text, 'Stop')) {
      await control('stop');
    }
  };

  return (
    <section className="stat-block" aria-label="Hashing">
      <header>
        <h3>Hashing</h3>
        <span className="grow muted" data-stat="hash-status">
          {hashingStatus(shown)}
        </span>
        {access('share_edit') && (
          <>
            <button type="button" onClick={() => void control(stats.pause_forced ? 'resume' : 'pause')}>
              {stats.pause_forced ? <Play size={12} /> : <Pause size={12} />}
              {stats.pause_forced ? 'Resume' : 'Pause'}
            </button>
            <button type="button" disabled={!hashingBusy(stats)} onClick={() => void stop()}>
              <Square size={12} />
              Stop
            </button>
          </>
        )}
      </header>
      <Progress value={hashingProgress(shown)} text={hashingText(shown)} />
    </section>
  );
};
