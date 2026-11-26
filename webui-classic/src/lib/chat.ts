export interface Completion {
  text: string;
  caret: number;
  /** State for the next Tab press */
  next: { base: string; start: number; matches: string[]; index: number };
}

/**
 * Tab completes the nick before the caret; pressing it again cycles through the matches.
 * "[TAG]Nick" style nicks also match without the leading tags.
 */
export const completeNick = (
  text: string,
  caret: number,
  nicks: string[],
  previous?: Completion['next'] | null,
): Completion | null => {
  let state = previous;
  if (state) {
    state = { ...state, index: (state.index + 1) % state.matches.length };
  } else {
    const start = text.lastIndexOf(' ', caret - 1) + 1;
    const lineStart = text.lastIndexOf('\n', caret - 1) + 1;
    const from = Math.max(start, lineStart);
    const typed = text.slice(from, caret).toLowerCase();
    if (!typed) {
      return null;
    }

    const bare = (nick: string) => nick.replace(/^(\[[^\]]*\]\s*)+/, '');
    const matches = [
      ...nicks.filter((n) => n.toLowerCase().startsWith(typed)),
      ...nicks.filter((n) => !n.toLowerCase().startsWith(typed) && bare(n).toLowerCase().startsWith(typed)),
    ];
    if (!matches.length) {
      return null;
    }

    state = { base: text.slice(0, from) + '\u0000' + text.slice(caret), start: from, matches, index: 0 };
  }

  const insert = state.matches[state.index] + (state.start === 0 ? ': ' : ' ');
  const [before, after] = state.base.split('\u0000');
  return { text: before + insert + after.replace(/^ /, ''), caret: before.length + insert.length, next: state };
};

export type Command =
  | { type: 'message'; text: string; thirdPerson: boolean }
  | { type: 'clear' }
  | { type: 'help' }
  /** A command that isn't handled here */
  | { type: 'other' };

export const isCommand = (input: string) => input.startsWith('/');

/** What the interface does itself; commands are passed on to the client as well (see commandRequests) */
export const parseCommand = (input: string): Command => {
  const match = /^\/(\S*)(?:\s+([\s\S]*))?$/.exec(input);
  if (!match) {
    return isCommand(input) ? { type: 'other' } : { type: 'message', text: input, thirdPerson: false };
  }

  const [, name, params = ''] = match;
  switch (name.toLowerCase()) {
    case 'me':
      return params.trim() ? { type: 'message', text: params, thirdPerson: true } : { type: 'help' };
    case 'clear':
      return { type: 'clear' };
    case 'help':
      return { type: 'help' };
    default:
      return { type: 'other' };
  }
};

export interface MessageRequest {
  text: string;
  third_person?: boolean;
}

/**
 * What is posted to the chat. Every command is passed on to the client as written: extensions receive it from there.
 * The client never sends a text that starts with "/" to the hub or to the other user.
 */
export const messageRequests = (input: string): MessageRequest[] => {
  const command = parseCommand(input);
  return [
    ...(command.type === 'message' ? [{ text: command.text, third_person: command.thirdPerson }] : []),
    ...(isCommand(input) ? [{ text: input }] : []),
  ];
};
