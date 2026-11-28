// "Match ADL" of a file list
import type { AdlState, FilelistSession } from '../api/types';
import { hasAccess } from '../lib/access';
import { reportError, toast } from '../store/app';
import { socket } from '../store/session';
import { confirm } from '../store/ui';
import { showWindow } from '.';

/** Matches the ADL searches against an open list; false if that wasn't started */
export const matchAdl = async (list: FilelistSession): Promise<boolean> => {
  // Not all users may see the searches
  const adl = hasAccess('settings_view')
    ? await socket.get<AdlState>('adl/searches').catch(() => null)
    : null;
  // Old results are removed also when there are no searches, but a download isn't worth it then
  if (adl && !adl.searches.some((s) => s.active)) {
    if (await confirm('Match ADL', 'There are no ADL searches that are switched on. Open ADL Search?', 'Open')) {
      showWindow('adl');
    }

    return false;
  }

  const own = list.user.flags.includes('self');
  const download = !own && list.partial_list;
  if (
    download &&
    !(await confirm(
      'Match ADL',
      `Only a part of the list of ${list.user.nicks} is open. Download the full list and match it?`,
      'Download',
    ))
  ) {
    return false;
  }

  try {
    await socket.post(`filelists/${list.id}/adl_match`);
  } catch (e) {
    reportError('Match ADL')(e);
    return false;
  }

  toast(
    download
      ? 'Downloading the full file list. What matches is shown at the top of the list.'
      : 'Matching the ADL searches. What matches is shown at the top of the list.',
  );
  return true;
};
