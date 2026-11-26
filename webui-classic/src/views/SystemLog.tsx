import { CircleAlert, Info, MessageCircle, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { copyText } from '../actions';
import { MessageText } from '../components/MessageText';
import { Time } from '../components/Time';
import type { LogMessage, Severity } from '../api/types';
import { useFollowBottom } from '../lib/useFollowBottom';
import { reportError, useApp } from '../store/app';
import { socket } from '../store/session';
import { openMenu } from '../store/ui';
import { useMarkRead } from '../store/useSession';

export const SeverityIcon = ({ severity }: { severity: Severity }) => {
  const Icon =
    severity === 'error' ? CircleAlert : severity === 'warning' ? TriangleAlert : severity === 'verbose' ? MessageCircle : Info;
  return <Icon size={13} className={`severity ${severity}`} aria-label={severity} />;
};

const Line = ({ message }: { message: LogMessage }) => (
  <div className={`line log ${message.severity}`}>
    <SeverityIcon severity={message.severity} />
    <Time value={message.time} />
    {message.label && <span className="label">{message.label}:</span>}{' '}
    <MessageText text={message.text} highlights={message.highlights} />
  </div>
);

export const SystemLog = ({ active }: { active: boolean }) => {
  const messages = useApp((s) => s.messages.syslog);
  const counts = useApp((s) => s.logCounts);
  const log = useFollowBottom<HTMLDivElement>(messages);
  useMarkRead(active, counts, 'events/read');

  useEffect(() => {
    if (active) {
      log.ref.current?.focus({ preventScroll: true });
    }
  }, [active]);

  const clear = () =>
    socket
      .delete('events')
      .then(() => useApp.setState((s) => ({ messages: { ...s.messages, syslog: [] }, lastEvent: null })), reportError('Clear'));

  return (
    <div
      ref={log.ref}
      className="chat-log system-log selectable"
      role="log"
      tabIndex={0}
      onScroll={log.onScroll}
      onContextMenu={(e) => {
        const selected = window.getSelection()?.toString();
        e.preventDefault();
        openMenu({ x: e.clientX, y: e.clientY }, [
          { label: 'Copy selection', disabled: !selected, onClick: () => void copyText(selected!) },
          { label: 'Scroll to the end', onClick: log.follow },
          'separator',
          { label: 'Clear the system log', onClick: () => void clear() },
        ]);
      }}
    >
      {!messages?.length && <div className="line status">No messages</div>}
      {messages?.map((m) => <Line key={m.log_message!.id} message={m.log_message!} />)}
    </div>
  );
};
