// Actions on the whole download queue and on its users
import type { ApiError } from '../api/socket';
import type { HintedUser, QueueBundle, QueueFile, Transfer } from '../api/types';
import { bundlesFor } from '../lib/queueFile';
import { reportError, toast } from '../store/app';
import { socket } from '../store/session';
import { confirm, showDialog } from '../store/ui';

const PAUSED_FORCED = 0;
const AUTOMATIC = -1;

const setAllPriorities = (priority: number, done: string, action: string) =>
  socket.post('queue/bundles/priority', { priority }).then(() => toast(done), reportError(action));

export const pauseAll = () => setAllPriorities(PAUSED_FORCED, 'All downloads were paused', 'Pause all');

export const resumeAll = () => setAllPriorities(AUTOMATIC, 'All downloads were resumed', 'Resume all');

/** Shares finished downloads whose content check failed, after a new check or without one */
export const shareBundles = async (bundles: QueueBundle[], skipValidation: boolean) => {
  const action = skipValidation ? 'Force in share' : 'Rescan for errors';
  for (const bundle of bundles) {
    await socket
      .post(`queue/bundles/${bundle.id}/share`, { skip_validation: skipValidation })
      .catch(reportError(`${action}: ${bundle.name}`));
  }
};

/** Removes users as sources of everything in the queue. Returns false if cancelled. */
export const removeUsersFromQueue = async (users: HintedUser[]): Promise<boolean> => {
  const unique = [...new Map(users.map((u) => [u.cid, u])).values()];
  const who = unique.length === 1 ? unique[0].nicks : `${unique.length} users`;
  if (!unique.length || !(await confirm('Remove user from queue', `Remove ${who} as a source from all queued files?`, 'Remove'))) {
    return false;
  }

  for (const user of unique) {
    await socket.delete<{ count: number }>(`queue/sources/${user.cid}`).then(
      (result) => toast(`${user.nicks} was removed from ${result.count} file(s)`),
      reportError(`Remove ${user.nicks}`),
    );
  }

  return true;
};

/**
 * The queue ID of the file of a download, or null if it isn't queued anymore.
 * The ID reported with a transfer can't be trusted: the client keeps the old one when it continues with another
 * file over the same connection. The target path is up to date, so the file is looked up with that.
 */
const findQueuedFile = async (download: QueuedDownload): Promise<number | null> => {
  if (download.queue_file_id) {
    const file = await socket.get<QueueFile>(`queue/files/${download.queue_file_id}`).catch((e: ApiError) => {
      if (e.code !== 404) {
        throw e;
      }

      return null;
    });
    if (file?.target === download.target) {
      return file.id;
    }
  }

  const bundles = await socket.get<QueueBundle[]>('queue/bundles/0/100000');
  for (const bundle of bundlesFor(bundles, download.target)) {
    const files = await socket.get<QueueFile[]>(`queue/bundles/${bundle.id}/files/0/100000`);
    const file = files.find((f) => f.target === download.target);
    if (file) {
      return file.id;
    }
  }

  return null;
};

export type QueuedDownload = Pick<Transfer, 'name' | 'target' | 'queue_file_id'>;

/** Removes the files of downloads from the queue, after asking about the downloaded data */
export const removeQueuedFiles = async (downloads: QueuedDownload[]) => {
  // A file can be downloaded over several connections
  const unique = [...new Map(downloads.map((d) => [d.target, d])).values()];
  if (!unique.length) {
    return;
  }

  const result = await showDialog({
    title: 'Remove file from queue',
    text:
      unique.length === 1
        ? `Remove "${unique[0].name}" from the queue?`
        : `Remove ${unique.length} files from the queue?`,
    fields: [{ key: 'remove_finished', label: 'Also delete the file from disk if it has finished', type: 'boolean' }],
    confirmLabel: 'Remove',
  });
  if (!result) {
    return;
  }

  for (const download of unique) {
    // A transfer stays in the list for a while, also after its file has left the queue
    const gone = () => toast(`${download.name} was not found in the queue`);
    try {
      const id = await findQueuedFile(download);
      if (id === null) {
        gone();
        continue;
      }

      await socket.post(`queue/files/${id}/remove`, result);
      toast(`Removed from queue: ${download.name}`);
    } catch (e) {
      if ((e as ApiError).code === 404) {
        gone();
      } else {
        reportError(`Remove ${download.name}`)(e);
      }
    }
  }
};
