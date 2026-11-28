// Title, icon and attention state of the windows
import {
  ArrowDownUp,
  Download,
  FileText,
  Film,
  Folder,
  House,
  Image,
  MessageSquare,
  Music,
  ScrollText,
  Search,
  Server,
  Settings,
  Star,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { windowId, windowType, type AppState } from '../store/app';
import { colorsDoc } from '../store/docs';
import { hubCaption, hubTopic } from './hubTitle';
import { currentTabEvent, type TabEventId, type TabHighlights } from './tabEvents';

export type Attention = 'mention' | 'unread' | null;

export interface WindowInfo {
  title: string;
  /** Hubs: the full title, with the topic */
  caption?: string;
  /** Hubs: the topic */
  topic?: string;
  icon: ReactNode;
  attention: Attention;
  /** Chats: what has happened, which decides how the tab looks */
  event?: TabEventId;
  /** Shown as a tooltip */
  detail?: string;
}

const ICON = 14;

export const windowInfo = (
  key: string,
  state: AppState,
  highlight: TabHighlights = colorsDoc.value.highlight,
): WindowInfo => {
  const id = windowId(key);
  switch (windowType(key)) {
    case 'home':
      return { title: 'Home', icon: <House size={ICON} className="i-info" />, attention: null };
    case 'syslog': {
      const unread = state.logCounts?.unread as Record<string, number> | undefined;
      return {
        title: 'System log',
        icon: <ScrollText size={ICON} className="i-info" />,
        attention: unread?.error || unread?.warning ? 'mention' : unread?.info ? 'unread' : null,
      };
    }
    case 'favorites':
      return { title: 'Favorite hubs', icon: <Star size={ICON} className="i-star" />, attention: null };
    case 'queue':
      return { title: 'Download queue', icon: <Download size={ICON} className="i-down" />, attention: null };
    case 'settings':
      return { title: 'Settings', icon: <Settings size={ICON} />, attention: null };
    case 'transfers':
      return { title: 'Transfers', icon: <ArrowDownUp size={ICON} className="i-up" />, attention: null };
    case 'hub': {
      const hub = state.hubs.find((h) => String(h.id) === id);
      const event = currentTabEvent('hub', hub?.message_counts.unread, highlight);
      return {
        title: hub?.identity.name || hub?.hub_url || 'Hub',
        caption: hub && hubCaption(hub),
        topic: hub && hubTopic(hub),
        detail: hub && `${hub.hub_url}: ${hub.connect_state.str}`,
        icon: <Server size={ICON} className={`i-hub ${hub?.connect_state.id ?? ''}`} />,
        attention: event?.level ?? null,
        event: event?.id,
      };
    }
    case 'pm': {
      const chat = state.chats.find((c) => c.id === id);
      const event = currentTabEvent('pm', chat?.message_counts.unread, highlight);
      return {
        title: chat?.user.nicks ?? 'Private message',
        detail: chat?.user.hub_names,
        icon: <MessageSquare size={ICON} className={`i-pm${chat?.user.flags.includes('offline') ? ' offline' : ''}`} />,
        attention: event?.level ?? null,
        event: event?.id,
      };
    }
    case 'filelist': {
      const list = state.filelists.find((l) => l.id === id);
      return {
        title: list?.user.nicks ?? 'File list',
        detail: list?.user.hub_names,
        icon: <Folder size={ICON} className="i-folder" />,
        attention: list && !list.read && list.state.id === 'loaded' ? 'unread' : null,
      };
    }
    case 'file': {
      const file = state.files.find((f) => f.id === id);
      const contentType = file && !file.text && file.type.id === 'file' ? file.type.content_type : '';
      const Icon = contentType === 'picture' ? Image : contentType === 'audio' ? Music : contentType === 'video' ? Film : FileText;
      return {
        title: file?.name ?? 'File',
        detail: file?.download_state?.str,
        icon: <Icon size={ICON} className="i-info" />,
        attention: file && !file.read && file.content_ready ? 'unread' : null,
      };
    }
    case 'search': {
      const search = state.searches.find((s) => s.key === key);
      return { title: search?.title ?? 'Search', icon: <Search size={ICON} className="i-search" />, attention: null };
    }
  }
};
