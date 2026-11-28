// The title bar of large screens: the name of the program and the title of the shown window, as a desktop client
// writes them. The title of a hub window holds the topic of the hub.
import { windowInfo } from '../lib/windows';
import { useApp } from '../store/app';

export const TitleBar = () => {
  // As a text, so that the bar is only drawn again when that changes
  const text = useApp((s) => {
    const info = s.active ? windowInfo(s.active, s) : null;
    return info ? `AirDC++ Classic - [${info.caption ?? info.title}]` : 'AirDC++ Classic';
  });

  return (
    <div className="titlebar" title={text}>
      {text}
    </div>
  );
};
