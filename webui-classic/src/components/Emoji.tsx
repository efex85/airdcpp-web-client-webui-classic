// An emoticon in a text, and the button that inserts one into a message
import { Smile } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Emoticon } from '../lib/emoji';
import type { ActiveEmoji } from '../store/emoji';

export const EmojiView = ({ emoticon }: { emoticon: Emoticon }) => {
  const { code, emoji, image } = emoticon;
  return image ? (
    // The text code stays available as the alternative text (also when copying) and as the tooltip
    <img
      className="emoticon"
      src={image.url}
      alt={code}
      title={code}
      draggable={false}
      width={image.width}
      height={image.height}
      style={{ '--w': image.width, '--h': image.height } as CSSProperties}
    />
  ) : (
    <span className="emoji" title={code}>
      {emoji}
    </span>
  );
};

interface Props {
  /** Null while the emoticons are being loaded */
  active: ActiveEmoji | null;
  disabled?: boolean;
  /** The chat window is the one that is shown */
  shown: boolean;
  onPick: (code: string) => void;
}

export const EmojiPicker = ({ active, disabled, shown, onPick }: Props) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const visible = open && shown && !disabled;

  useEffect(() => {
    if (!visible) {
      setOpen(false);
      return;
    }

    const onPointer = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [visible]);

  return (
    <div className="emoji-picker" ref={root}>
      <button
        type="button"
        className="emoji-button"
        aria-label="Insert emoji"
        title="Insert emoji"
        aria-haspopup="dialog"
        aria-expanded={visible}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <Smile size={14} />
      </button>
      {visible && (
        <div className="emoji-panel" role="dialog" aria-label="Emoji">
          {!active && <div className="muted">Loading…</div>}
          {active?.picker.map((group) => (
            <div key={group.title} className="emoji-group">
              {group.title && <h3>{group.title}</h3>}
              <div className="emoji-grid">
                {group.items.map((item) => (
                  <button
                    key={item.insert}
                    type="button"
                    title={item.insert}
                    aria-label={item.insert}
                    onClick={() => {
                      setOpen(false);
                      onPick(item.insert);
                    }}
                  >
                    <EmojiView emoticon={item.shown} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
