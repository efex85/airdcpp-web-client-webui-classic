// The title bar of large screens: the name of the program and the title of the shown window, as a desktop client
// writes them. Hub windows have a title of their own, as the Windows client writes it.
import { windowInfo } from '../lib/windows';
import { useApp } from '../store/app';

export const TitleBar = () => {
  // As a text, so that the bar is only drawn again when that changes
  const text = useApp((s) => {
    const info = s.active ? windowInfo(s.active, s) : null;
    return info ? (info.caption ?? `AirDC++ Classic - [${info.title}]`) : 'AirDC++ Classic';
  });

  return (
    <div className="titlebar" title={text}>
      {text}
    </div>
  );
};
