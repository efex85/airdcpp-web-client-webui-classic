// The text of a viewed file with its addresses as links. They are shown exactly as written.
import { Fragment, useMemo, type MouseEvent } from 'react';
import { connectHub } from '../actions';
import { parseMagnet } from '../lib/highlight';
import { splitTextLinks, type TextPiece } from '../lib/textLinks';
import { magnetMenu } from './MessageText';

const Link = ({ text, link }: Required<TextPiece>) => {
  if (link.kind === 'web') {
    return (
      <a className="link" href={link.address} target="_blank" rel="noopener noreferrer">
        {text}
      </a>
    );
  }

  const open = (e: MouseEvent) => {
    const magnet = parseMagnet(link.address);
    if (magnet) {
      magnetMenu({ x: e.clientX, y: e.clientY }, link.address, magnet);
    } else {
      void connectHub(link.address);
    }
  };

  return (
    <button
      type="button"
      className="link"
      title={link.kind === 'hub' ? 'Connect to the hub' : 'Download, search or copy'}
      onClick={open}
      onContextMenu={
        link.kind === 'magnet'
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              open(e);
            }
          : undefined
      }
    >
      {text}
    </button>
  );
};

export const LinkedText = ({ text }: { text: string }) => {
  const pieces = useMemo(() => splitTextLinks(text), [text]);
  return (
    <>
      {pieces.map(({ text: part, link }, i) =>
        link ? <Link key={i} text={part} link={link} /> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
};
