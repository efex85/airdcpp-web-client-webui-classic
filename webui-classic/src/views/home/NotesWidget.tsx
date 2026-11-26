// Free text that is saved while typing
import { MAX_NOTE_LENGTH } from '../../lib/widgets';
import { noteDoc, setNote, useDoc, useDocStatus } from '../../store/docs';

export const NotesWidget = ({ id, title }: { id: string; title: string }) => {
  const doc = noteDoc(id);
  const text = useDoc(doc);
  const status = useDocStatus(doc);

  return (
    <>
      {/* On phones the box is as high as its text, which the style sheet measures with a copy of it */}
      <div className="notes-box" data-value={text}>
        <textarea
          className="notes"
          aria-label={title}
          placeholder="Write your notes here"
          value={text}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(e) => setNote(id, e.target.value)}
          onBlur={() => void doc.flush()}
        />
      </div>
      <div className="widget-footer">
        <span className="muted grow" data-status={status}>
          {status === 'synced' ? (text ? 'Saved' : '') : status === 'pending' ? 'Not saved yet…' : 'Saved in this browser only'}
        </span>
        {text.length > MAX_NOTE_LENGTH * 0.9 && (
          <span className="muted">
            {text.length} / {MAX_NOTE_LENGTH}
          </span>
        )}
      </div>
    </>
  );
};
