// The timestamp in front of a chat or log line
import { formatChatTime } from '../lib/format';
import { useLocalSettings } from '../store/localSettings';

export const Time = ({ value }: { value: number }) => {
  const style = useLocalSettings((s) => s.chat_timestamps);
  const text = formatChatTime(value, style);
  return text ? (
    <>
      <span className="time">[{text}]</span>{' '}
    </>
  ) : null;
};
