// Free disk space in the System information widget
import { useEffect, useState } from 'react';
import type { ShareRoot } from '../../api/settingsTypes';
import { Progress } from '../../components/Progress';
import { useAccess } from '../../lib/access';
import { diskFolderNames, diskIsLow, diskUsedPercent, groupDisks, type Disk, type DiskInfo } from '../../lib/disks';
import { formatSize } from '../../lib/format';
import { useHeld } from '../../lib/useSelecting';
import { useApp } from '../../store/app';
import { socket } from '../../store/session';

const INTERVAL = 30_000;

/** The disks of the download folder and, with permission to see them, of the shared folders */
const loadDisks = async (shares: boolean): Promise<Disk[]> => {
  const [settings, roots] = await Promise.all([
    socket.post<{ download_directory?: string }>('settings/get', { keys: ['download_directory'] }),
    shares ? socket.get<ShareRoot[]>('share_roots') : Promise.resolve([]),
  ]);
  const download = settings.download_directory;
  const folders = [
    ...(download ? [{ name: 'Download folder', path: download }] : []),
    ...roots
      .map((root) => ({ name: root.virtual_name, path: root.path }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];
  if (!folders.length) {
    return [];
  }

  const infos = await socket.post<DiskInfo[]>('filesystem/disk_info', { paths: folders.map((f) => f.path) });
  return groupDisks(folders, infos);
};

export const DiskStats = ({ active, held }: { active: boolean; held: boolean }) => {
  const access = useAccess();
  const shares = access('share_view');
  const generation = useApp((s) => s.generation);
  const [loaded, setDisks] = useState<Disk[]>([]);
  const disks = useHeld(loaded, held);

  useEffect(() => {
    if (!active) {
      return;
    }

    let current = true;
    const load = () =>
      void loadDisks(shares).then(
        (result) => current && setDisks(result),
        () => undefined,
      );
    load();
    const timer = setInterval(load, INTERVAL);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [shares, active, generation]);

  if (!disks.length) {
    return null;
  }

  return (
    <section className="stat-block" aria-label="Disk space">
      <header>
        <h3>Disk space</h3>
      </header>
      {disks.map((disk) => (
        <div className="disk" key={disk.folders[0]!.path} title={disk.folders.map((f) => f.path).join('\n')}>
          <div>{diskFolderNames(disk.folders)}</div>
          <Progress
            value={diskUsedPercent(disk)}
            low={diskIsLow(disk)}
            text={disk.total ? `${formatSize(disk.free)} free of ${formatSize(disk.total)}` : 'Size unknown'}
          />
        </div>
      ))}
    </section>
  );
};
