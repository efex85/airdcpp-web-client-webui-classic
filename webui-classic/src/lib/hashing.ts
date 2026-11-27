// What the System stats widget says about hashing
import type { HashStats } from '../api/settingsTypes';
import { formatDuration, formatSize, formatSpeed } from './format';

/** Files are being hashed or waiting for it */
export const hashingBusy = (stats: HashStats) => stats.hashers > 0 || stats.hash_files_left > 0;

export const hashingStatus = (stats: HashStats): string => {
  if (stats.pause_forced) {
    // The client finishes the file that it's working on before it pauses
    return stats.hashers > 0 ? 'Pausing after this file' : 'Paused';
  }

  if (!hashingBusy(stats)) {
    return 'Idle';
  }

  if (stats.hash_speed <= 0) {
    return 'Running';
  }

  const speed = formatSpeed(stats.hash_speed);
  return `${speed}, ${formatDuration(stats.hash_bytes_left / stats.hash_speed) || '0:00'} left`;
};

/** Percent of the data that has been queued since the hashing started */
export const hashingProgress = (stats: HashStats): number =>
  hashingBusy(stats) && stats.hash_bytes_added > 0
    ? Math.min(100, Math.max(0, (1 - stats.hash_bytes_left / stats.hash_bytes_added) * 100))
    : 0;

export const hashingText = (stats: HashStats): string =>
  stats.hash_files_left > 0
    ? `${stats.hash_files_left} ${stats.hash_files_left === 1 ? 'file' : 'files'}, ${formatSize(stats.hash_bytes_left)} left`
    : 'Nothing to hash';
