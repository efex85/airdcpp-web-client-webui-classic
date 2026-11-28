// Shows a file opened for viewing: text (NFO, with working links), image, audio or video
import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { copyText } from '../actions';
import { getBasePath } from '../api/socket';
import type { ViewFile } from '../api/types';
import { LinkedText } from '../components/LinkedText';
import { formatDate } from '../lib/format';
import { load, save } from '../lib/storage';
import { decodeText, type ViewKind } from '../lib/viewFile';
import { useApp } from '../store/app';
import { socket } from '../store/session';

const fileUrl = (tth: string) => `${getBasePath(window.location.pathname)}view/${tth}`;

const kindOf = (file: ViewFile): ViewKind | null => {
  if (file.text) {
    return 'text';
  }

  switch (file.type.id === 'file' ? file.type.content_type : '') {
    case 'picture':
      return 'image';
    case 'audio':
      return 'audio';
    case 'video':
      return 'video';
    default:
      return null;
  }
};

/** The content of a file, requested with the login of this session */
const useContent = (tth: string) => {
  const [content, setContent] = useState<{ data?: Blob; error?: string }>({});

  useEffect(() => {
    const controller = new AbortController();
    const login = useApp.getState().login;
    setContent({});
    fetch(fileUrl(tth), {
      signal: controller.signal,
      // The standard Authorization header may be used by a reverse proxy
      headers: { 'X-Authorization': `${login?.token_type ?? 'Bearer'} ${login?.auth_token ?? ''}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          const text = (await response.text().catch(() => '')).trim();
          throw new Error(text.slice(0, 200) || `Request failed (${response.status})`);
        }

        setContent({ data: await response.blob() });
      })
      .catch((e: Error) => !controller.signal.aborted && setContent({ error: e.message }));

    return () => controller.abort();
  }, [tth]);

  return content;
};

const Message = ({ text, error }: { text: string; error?: boolean }) => (
  <div className={`view-empty${error ? ' error' : ''}`} role={error ? 'alert' : 'status'}>
    {text}
  </div>
);

const TextContent = ({ file }: { file: ViewFile }) => {
  const { data, error } = useContent(file.tth);
  const [text, setText] = useState<string | null>(null);
  // NFO files are drawn with characters that must not be wrapped
  const [wrap, setWrap] = useState(() => load('viewerWrap', false));

  useEffect(() => {
    let current = true;
    void data?.arrayBuffer().then((buffer) => current && setText(decodeText(buffer)));
    return () => {
      current = false;
    };
  }, [data]);

  if (error) {
    return <Message error text={`Failed to open the file: ${error}`} />;
  }

  if (text === null) {
    return <Message text="Loading…" />;
  }

  return (
    <>
      <div className="viewer-tools">
        <label className="check-field">
          <input
            type="checkbox"
            checked={wrap}
            onChange={(e) => {
              setWrap(e.target.checked);
              save('viewerWrap', e.target.checked);
            }}
          />
          Wrap long lines
        </label>
        <button type="button" onClick={() => void copyText(text)}>
          <Copy size={13} /> Copy all
        </button>
      </div>
      <pre className={`viewer-text${wrap ? ' wrap' : ''}`} tabIndex={0}>
        <LinkedText text={text} />
      </pre>
    </>
  );
};

const ImageContent = ({ file }: { file: ViewFile }) => {
  const { data, error } = useContent(file.tth);
  const [url, setUrl] = useState<string | null>(null);
  const [fullSize, setFullSize] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!data) {
      return;
    }

    const created = URL.createObjectURL(data);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [data]);

  if (error || broken) {
    return <Message error text={error ? `Failed to open the file: ${error}` : 'The browser can’t show this image'} />;
  }

  if (!url) {
    return <Message text="Loading…" />;
  }

  return (
    <div className={`viewer-image${fullSize ? ' full' : ''}`}>
      <button
        type="button"
        title={fullSize ? 'Fit to the window' : 'Show in full size'}
        onClick={() => setFullSize(!fullSize)}
      >
        <img src={url} alt={file.name} onError={() => setBroken(true)} />
      </button>
    </div>
  );
};

const MediaContent = ({ file, kind }: { file: ViewFile; kind: 'audio' | 'video' }) => {
  const [failed, setFailed] = useState(false);
  // Playback starts by itself for a file that was just opened
  const [autoPlay] = useState(() => Date.now() / 1000 - file.time_opened < 60);
  // The player requests parts of the file by itself, so the login has to be a part of the address
  const [url] = useState(
    () => `${fileUrl(file.tth)}?auth_token=${encodeURIComponent(useApp.getState().login?.auth_token ?? '')}`,
  );
  const Player = kind;

  if (failed) {
    return <Message error text="The file can’t be played. The browser may not support this format." />;
  }

  return (
    <div className="viewer-media">
      <Player src={url} controls autoPlay={autoPlay} playsInline onError={() => setFailed(true)} />
    </div>
  );
};

const Content = ({ file }: { file: ViewFile }) => {
  if (!file.content_ready) {
    const failed = file.download_state?.id === 'download_failed';
    return (
      <Message
        error={failed}
        text={
          failed
            ? `Download failed: ${file.download_state!.str}`
            : `Downloading the file… ${file.download_state?.str ?? ''}`
        }
      />
    );
  }

  const kind = kindOf(file);
  switch (kind) {
    case 'text':
      return <TextContent file={file} />;
    case 'image':
      return <ImageContent file={file} />;
    case 'audio':
    case 'video':
      return <MediaContent file={file} kind={kind} />;
    default:
      return <Message text="This kind of file can’t be shown" />;
  }
};

export const FileViewer = ({ id, active }: { id: string; active: boolean }) => {
  const file = useApp((s) => s.files.find((f) => f.id === id));

  useEffect(() => {
    if (active && file && !file.read && file.content_ready) {
      socket.post(`view_files/${id}/read`).catch(() => undefined);
    }
  }, [active, id, file?.read, file?.content_ready]);

  if (!file) {
    return <div className="view-empty">The file has been closed</div>;
  }

  return (
    <div className="view viewer">
      <div className="view-main">
        <Content key={file.tth} file={file} />
      </div>
      <div className="view-status">
        <span className="grow">{file.name}</span>
        <span>Opened {formatDate(file.time_opened)}</span>
      </div>
    </div>
  );
};
