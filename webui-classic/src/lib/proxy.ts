// Requests to other servers go through the client, as browsers don't allow most of them
import { getBasePath } from '../api/socket';
import { useApp } from '../store/app';

const requestThroughClient = async (url: string): Promise<Response> => {
  const login = useApp.getState().login;
  const response = await fetch(`${getBasePath(window.location.pathname)}proxy?url=${encodeURIComponent(url)}`, {
    cache: 'no-store',
    headers: {
      // The standard Authorization header may be used by a reverse proxy
      'X-Authorization': `${login?.token_type ?? 'Bearer'} ${login?.auth_token ?? ''}`,
    },
  });
  if (!response.ok) {
    const text = (await response.text().catch(() => '')).trim();
    throw new Error(text.slice(0, 200) || `Request failed (${response.status})`);
  }

  return response;
};

export const fetchThroughClient = async <T,>(url: string): Promise<T> =>
  (await (await requestThroughClient(url)).json()) as T;

/** The text of an XML document in the character set that it or the server declares */
export const decodeXml = (data: ArrayBuffer, contentType: string): string => {
  const start = new TextDecoder('latin1').decode(data.slice(0, 200));
  const declared =
    /charset=["']?([\w.:-]+)/i.exec(contentType)?.[1] ?? /<\?xml[^>]*encoding=["']([\w.:-]+)["']/i.exec(start)?.[1];
  try {
    return new TextDecoder(declared ?? 'utf-8').decode(data);
  } catch {
    return new TextDecoder().decode(data); // Unknown character set
  }
};

export const fetchXmlThroughClient = async (url: string): Promise<string> => {
  const response = await requestThroughClient(url);
  return decodeXml(await response.arrayBuffer(), response.headers.get('content-type') ?? '');
};
