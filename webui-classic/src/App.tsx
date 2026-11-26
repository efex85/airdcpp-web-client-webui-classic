import { useEffect, useRef } from 'react';
import { ContextMenuHost } from './components/ContextMenu';
import { DialogHost, Toasts } from './components/Dialogs';
import { MenuBar } from './components/MenuBar';
import { MobileBar } from './components/MobileBar';
import { Splitter } from './components/Splitter';
import { StatusBar } from './components/StatusBar';
import { TabBar } from './components/TabBar';
import { Toolbar } from './components/Toolbar';
import { windowInfo } from './lib/windows';
import { useIsMobile } from './lib/useIsMobile';
import { useApp, windowId, windowType } from './store/app';
import { colorsDoc, useDoc } from './store/docs';
import { useLocalSettings } from './store/localSettings';
import { logout } from './store/session';
import { FavoriteHubs } from './views/FavoriteHubs';
import { Filelist } from './views/Filelist';
import { FileViewer } from './views/FileViewer';
import { Home } from './views/home/Home';
import { Hub } from './views/Hub';
import { Login, SigningIn } from './views/Login';
import { PrivateChat } from './views/PrivateChat';
import { Queue } from './views/Queue';
import { SearchView } from './views/Search';
import { SettingsView } from './views/settings/Settings';
import { SystemLog } from './views/SystemLog';
import { Transfers } from './views/Transfers';

const WindowContent = ({ tabKey, active }: { tabKey: string; active: boolean }) => {
  const id = windowId(tabKey);
  switch (windowType(tabKey)) {
    case 'home':
      return <Home active={active} />;
    case 'syslog':
      return <SystemLog active={active} />;
    case 'favorites':
      return <FavoriteHubs />;
    case 'queue':
      return <Queue />;
    case 'transfers':
      return <Transfers />;
    case 'settings':
      return <SettingsView />;
    case 'hub':
      return <Hub id={Number(id)} active={active} />;
    case 'pm':
      return <PrivateChat id={id} active={active} />;
    case 'filelist':
      return <Filelist id={id} active={active} />;
    case 'search':
      return <SearchView tabKey={tabKey} active={active} />;
    case 'file':
      return <FileViewer id={id} active={active} />;
  }
};

/** Windows are created when first shown and then kept, so that they keep their state */
const Windows = () => {
  const tabs = useApp((s) => s.tabs);
  const active = useApp((s) => s.active);
  const background = useLocalSettings((s) => s.background_image_url);
  const visited = useRef(new Set<string>());
  if (active) {
    visited.current.add(active);
  }

  return (
    <div
      className={`windows${background ? ' has-background' : ''}`}
      // Encoded, so that the address can't end the CSS string
      style={background ? { backgroundImage: `url("${encodeURI(background)}")` } : undefined}
    >
      {tabs
        .filter((key) => visited.current.has(key))
        .map((key) => (
          <section key={key} className={`pane${key === active ? '' : ' hidden'}`}>
            <WindowContent tabKey={key} active={key === active} />
          </section>
        ))}
      {!tabs.length && <div className="view-empty">No open windows</div>}
    </div>
  );
};

const useDocumentTitle = () => {
  const { highlight } = useDoc(colorsDoc);
  const title = useApp((s) => {
    if (!s.login || !s.active) {
      return 'AirDC++ Classic';
    }

    const mention = s.tabs.some((key) => key !== 'syslog' && windowInfo(key, s, highlight).attention === 'mention');
    return `${mention ? '(*) ' : ''}${windowInfo(s.active, s, highlight).title} - AirDC++ Classic`;
  });

  useEffect(() => {
    document.title = title;
  }, [title]);
};

const Main = () => {
  const mobile = useIsMobile();
  const showTransfers = useApp((s) => s.showTransfers && s.active !== 'transfers');
  const reconnecting = useApp((s) => s.connection !== 'connected');

  return (
    <div className={`app${mobile ? ' mobile' : ''}`}>
      {mobile ? (
        <MobileBar />
      ) : (
        <>
          <MenuBar />
          <Toolbar />
        </>
      )}
      {reconnecting && (
        <div className="reconnecting" role="status">
          <span>The connection to the server was lost. Reconnecting…</span>
          <button type="button" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      )}
      <div className="app-main">
        {/* The splitter is kept on small screens, so that the windows survive a rotation */}
        <Splitter
          id="transfers"
          direction="column"
          initial={150}
          min={50}
          first={<Windows />}
          second={!mobile && showTransfers ? <Transfers /> : null}
        />
      </div>
      {!mobile && <TabBar />}
      <StatusBar />
    </div>
  );
};

export const App = () => {
  const loggedIn = useApp((s) => !!s.login);
  const resuming = useApp((s) => s.resuming);
  useDocumentTitle();

  return (
    <>
      {loggedIn ? <Main /> : resuming ? <SigningIn /> : <Login />}
      <ContextMenuHost />
      <DialogHost />
      <Toasts />
    </>
  );
};
