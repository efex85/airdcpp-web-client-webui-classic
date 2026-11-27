// Message text with the links, magnets and highlights reported by the daemon, and emoji
import { Magnet as MagnetIcon } from 'lucide-react';
import { copyText, connectHub, openSearch } from '../actions';
import { downloadMenu, fileDownload } from '../actions/download';
import { viewEntries } from '../actions/view';
import type { Dupe, Highlight, HintedUser } from '../api/types';
import { dupeClass } from '../lib/dupe';
import { MAX_PER_MESSAGE, splitEmoticons, type EmoticonMatcher } from '../lib/emoji';
import { formatSize } from '../lib/format';
import { isHubLink, isSafeLink, parseMagnet, splitHighlights, type Magnet } from '../lib/highlight';
import { openMenu, type MenuPosition } from '../store/ui';
import { EmojiView } from './Emoji';

const magnetMenu = (
  position: MenuPosition,
  url: string,
  magnet: Magnet,
  highlight: Highlight,
  user?: HintedUser,
) => {
  const file = {
    ...magnet,
    type: { id: 'file' as const, content_type: highlight.content_type ?? '', str: '' },
    dupe: highlight.dupe as Dupe | null,
  };
  // The sender is a source for the file, unless it's us or the user has left
  const source = user && !user.flags.includes('self') && !user.flags.includes('offline') ? user : undefined;
  openMenu(
    position,
    [
      ...downloadMenu([fileDownload(source, magnet)]),
      'separator',
      ...viewEntries(file, user),
      { label: 'Search for alternates', onClick: () => openSearch({ pattern: magnet.tth, fileType: 'tth' }) },
      { label: 'Copy magnet link', onClick: () => void copyText(url) },
    ],
    undefined,
    magnet.name,
  );
};

const Part = ({ text, highlight, sender }: { text: string; highlight: Highlight; sender?: HintedUser }) => {
  const kind = dupeClass(highlight.dupe as Dupe | null);
  const dupe = kind ? ` ${kind}` : '';

  if (highlight.type === 'link_url') {
    const magnet = parseMagnet(text);
    if (magnet) {
      return (
        <button
          type="button"
          className={`link magnet${dupe}`}
          title={text}
          onClick={(e) => magnetMenu({ x: e.clientX, y: e.clientY }, text, magnet, highlight, sender)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            magnetMenu({ x: e.clientX, y: e.clientY }, text, magnet, highlight, sender);
          }}
        >
          <MagnetIcon size={11} /> {magnet.name} ({formatSize(magnet.size)})
        </button>
      );
    }

    if (isHubLink(text)) {
      return (
        <button type="button" className="link" onClick={() => void connectHub(text)}>
          {text}
        </button>
      );
    }

    if (isSafeLink(text)) {
      return (
        <a className="link" href={/^www\./i.test(text) ? `https://${text}` : text} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      );
    }

    return <>{text}</>;
  }

  if (highlight.type === 'link_text') {
    return (
      <button
        type="button"
        className={`link release${dupe}`}
        title="Search"
        onClick={() => openSearch({ pattern: text })}
      >
        {text}
      </button>
    );
  }

  if (highlight.type === 'user') {
    return <span className={highlight.tag === 'me' ? 'mention' : 'user-highlight'}>{text}</span>;
  }

  return <b>{text}</b>;
};

export const MessageText = ({
  text,
  highlights,
  sender,
  emoji,
}: {
  text: string;
  highlights: Highlight[];
  sender?: HintedUser;
  /** Shows text codes as emoji; only outside of links and other highlights */
  emoji?: EmoticonMatcher;
}) => {
  const parts = splitHighlights(text, highlights ?? []);
  let left = MAX_PER_MESSAGE;
  return (
    <>
      {parts.map((part, i) => {
        if (part.highlight) {
          return <Part key={i} text={part.text} highlight={part.highlight} sender={sender} />;
        }

        if (!emoji) {
          return part.text;
        }

        const before = parts[i - 1]?.text.slice(-1) ?? '';
        const after = parts[i + 1]?.text[0] ?? '';
        return splitEmoticons(part.text, emoji, before, after, left).map((piece, j) => {
          if (typeof piece === 'string') {
            return piece;
          }

          left--;
          return <EmojiView key={`${i}-${j}`} emoticon={piece} />;
        });
      })}
    </>
  );
};
