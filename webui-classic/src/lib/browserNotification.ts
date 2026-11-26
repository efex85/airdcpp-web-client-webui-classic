// The notification support of the browser

export type NativeState = 'granted' | 'denied' | 'default' | 'insecure' | 'unsupported';

export const nativeState = (): NativeState => {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  // Browsers deny the permission outside secure contexts (HTTPS and localhost)
  if (!window.isSecureContext) {
    return 'insecure';
  }

  return Notification.permission;
};

/** Some browsers only show the question after a click */
export const requestPermission = async (): Promise<void> => {
  if (nativeState() === 'default') {
    await Notification.requestPermission();
  }
};

/** Returns false if the browser can't show the notification */
export const showNative = (title: string, body: string, tag: string | undefined, onClick?: () => void): boolean => {
  if (nativeState() !== 'granted') {
    return false;
  }

  try {
    const icon = document.querySelector<HTMLLinkElement>('link[rel=icon]')?.href;
    const notification = new Notification(title, { body, tag, icon });
    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
    setTimeout(() => notification.close(), 5000);
    return true;
  } catch {
    // E.g. mobile Chrome only supports notifications of service workers
    return false;
  }
};
