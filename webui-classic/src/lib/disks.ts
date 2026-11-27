// Free space of the disks that the client downloads to and shares from

export interface DiskFolder {
  name: string;
  path: string;
}

/** The response of filesystem/disk_info, one for each folder in the order of the request */
export interface DiskInfo {
  path: string;
  free_space: number;
  total_space: number;
}

export interface Disk {
  folders: DiskFolder[];
  /** Bytes; zero total: unknown */
  free: number;
  total: number;
}

// The client asks for one folder at a time, so the free space may change in between while files are written
const FREE_SPACE_TOLERANCE = 16 * 1024 * 1024;

/**
 * Folders with the same size and free space become one line. The client doesn't tell which disk a folder
 * is on, so two disks with the very same numbers share a line too (the numbers are right for both).
 */
export const groupDisks = (folders: DiskFolder[], infos: DiskInfo[]): Disk[] => {
  const disks: Disk[] = [];
  folders.forEach((folder, i) => {
    const info = infos[i];
    const known = !!info && info.total_space > 0 && info.free_space >= 0;
    const free = known ? info.free_space : 0;
    const total = known ? info.total_space : 0;
    const same = disks.find((d) => d.total === total && Math.abs(d.free - free) <= FREE_SPACE_TOLERANCE);
    if (same) {
      same.folders.push(folder);
    } else {
      disks.push({ folders: [folder], free, total });
    }
  });
  return disks;
};

const NAMES_SHOWN = 3;

/** "Download folder, Movies, Music + 2 more" */
export const diskFolderNames = (folders: DiskFolder[]): string => {
  const names = [...new Set(folders.map((f) => f.name))];
  const more = names.length - NAMES_SHOWN;
  return names.slice(0, NAMES_SHOWN).join(', ') + (more > 0 ? ` + ${more} more` : '');
};

export const diskUsedPercent = ({ free, total }: Disk): number =>
  total > 0 ? Math.min(100, Math.max(0, (1 - free / total) * 100)) : 0;

/** Less than a tenth of the disk is free */
export const diskIsLow = ({ free, total }: Disk): boolean => total > 0 && free < total / 10;
