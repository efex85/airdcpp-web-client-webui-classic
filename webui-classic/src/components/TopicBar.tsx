// The topic of a hub, above its chat. One line; a click or tap shows all of it.
import { useState } from 'react';

export const TopicBar = ({ topic }: { topic: string }) => {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    // Marking a part of the text with the mouse ends with a click too
    if (window.getSelection()?.isCollapsed !== false) {
      setOpen((old) => !old);
    }
  };

  return (
    <div
      className={`hub-topic selectable${open ? ' open' : ''}`}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      title={topic}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen(!open);
        }
      }}
    >
      <span>{topic}</span>
    </div>
  );
};
