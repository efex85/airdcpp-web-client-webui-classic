import type { HintedUser, OnlineUser } from '../api/types';

export const toHinted = (user: OnlineUser): HintedUser => ({
  cid: user.cid,
  nicks: user.nick,
  hub_url: user.hub_url,
  hub_names: user.hub_name,
  flags: user.flags,
});

/** CSS classes that give the nick its color */
export const nickClass = (flags: string[]): string => {
  const classes = ['nick'];
  // Which color wins if several apply is decided by the stylesheet
  for (const flag of ['bot', 'op', 'favorite', 'ignored', 'self']) {
    if (flags.includes(flag)) {
      classes.push(flag);
    }
  }

  // Our own nick is never shown as a bot or operator
  return classes.includes('self') ? 'nick self' : classes.join(' ');
};
