/** Progress bar with the status text on it, as in the transfer list of the classic clients */
export const Progress = ({ value, text, upload, done }: { value: number; text: string; upload?: boolean; done?: boolean }) => (
  <span
    className={`progress${upload ? ' upload' : ''}${done ? ' done' : ''}`}
    role="progressbar"
    aria-valuenow={Math.round(value)}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-label={text}
  >
    <span className="progress-fill" style={{ width: `${value}%` }} />
    <span className="progress-text">{text}</span>
  </span>
);
