import {
  ArrowDownUp,
  ChevronDown,
  Download,
  FolderOpen,
  FolderSync,
  House,
  ListFilter,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  Star,
  X,
  Zap,
} from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { closeWindow, openOwnList, openSearch, quickConnect, reconnectHub, refreshShare, showWindow } from '../actions';
import { favoriteMenu, refreshMenu, toggleTransferPane } from '../actions/mainMenu';
import { useApp, windowId, windowType } from '../store/app';
import { openSettings } from '../store/settingsNav';
import { openMenu, type MenuEntry } from '../store/ui';

interface ButtonProps {
  title: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}

const Button = ({ title, icon, onClick, disabled, pressed }: ButtonProps) => (
  <button
    type="button"
    className="tool"
    title={title}
    aria-label={title}
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
  >
    {icon}
  </button>
);

interface DropdownProps {
  title: string;
  menu: () => { entries: MenuEntry[]; more?: () => Promise<MenuEntry[]> };
}

const Dropdown = ({ title, menu }: DropdownProps) => (
  <button
    type="button"
    className="tool arrow"
    title={title}
    aria-label={title}
    aria-haspopup="menu"
    onClick={(e: MouseEvent<HTMLButtonElement>) => {
      const box = e.currentTarget.getBoundingClientRect();
      const { entries, more } = menu();
      openMenu({ x: box.left, y: box.bottom }, entries, more);
    }}
  >
    <ChevronDown size={11} />
  </button>
);

export const Toolbar = () => {
  const active = useApp((s) => s.active);
  const showTransfers = useApp((s) => s.showTransfers);
  const hubId = windowType(active) === 'hub' ? Number(windowId(active)) : null;
  const homeEnabled = useApp((s) => s.homeEnabled);
  const size = 18;

  return (
    <div className="toolbar" role="toolbar" aria-label="Toolbar">
      <Button
        title="Reconnect the hub"
        icon={<RefreshCw size={size} className="i-ok" />}
        disabled={hubId === null}
        onClick={() => void reconnectHub(hubId!)}
      />
      <Button
        title="Close the window"
        icon={<X size={size} className="i-close" />}
        disabled={!active}
        onClick={() => void closeWindow(active)}
      />
      <span className="separator" />
      {homeEnabled && (
        <Button
          title="Home"
          icon={<House size={size} className="i-info" />}
          pressed={active === 'home'}
          onClick={() => showWindow('home')}
        />
      )}
      <Button
        title="Favorite hubs"
        icon={<Star size={size} className="i-star" />}
        pressed={active === 'favorites'}
        onClick={() => showWindow('favorites')}
      />
      <Dropdown title="Connect to a favorite hub" menu={() => ({ entries: favoriteMenu() })} />
      <Button title="Quick connect" icon={<Zap size={size} className="i-warn" />} onClick={() => void quickConnect()} />
      <span className="separator" />
      <Button
        title="Download queue"
        icon={<Download size={size} className="i-down" />}
        pressed={active === 'queue'}
        onClick={() => showWindow('queue')}
      />
      <Button
        title="ADL Search"
        icon={<ListFilter size={size} className="i-search" />}
        pressed={active === 'adl'}
        onClick={() => showWindow('adl')}
      />
      <Button
        title="Show the transfer pane"
        icon={<ArrowDownUp size={size} className="i-up" />}
        pressed={showTransfers}
        onClick={toggleTransferPane}
      />
      <span className="separator" />
      <Button title="Search" icon={<Search size={size} className="i-search" />} onClick={() => openSearch()} />
      <Button
        title="Open own file list"
        icon={<FolderOpen size={size} className="i-folder" />}
        onClick={() => void openOwnList()}
      />
      <Button
        title="System log"
        icon={<ScrollText size={size} className="i-info" />}
        pressed={active === 'syslog'}
        onClick={() => showWindow('syslog')}
      />
      <span className="separator" />
      <Button title="Refresh share" icon={<FolderSync size={size} className="i-ok" />} onClick={() => void refreshShare()} />
      <Dropdown title="Refresh options" menu={refreshMenu} />
      <span className="separator" />
      <Button
        title="Settings"
        icon={<Settings size={size} />}
        pressed={active === 'settings'}
        onClick={() => openSettings()}
      />
    </div>
  );
};
