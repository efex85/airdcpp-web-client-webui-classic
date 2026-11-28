// Permissions of the logged in user
import { useApp } from '../store/app';

export type Permission =
  | 'admin'
  | 'transfers'
  | 'share_view'
  | 'share_edit'
  | 'settings_view'
  | 'settings_edit'
  | 'filesystem_view'
  | 'filesystem_edit'
  | 'hubs_view'
  | 'private_chat_edit'
  | 'filelists_view'
  | 'view_file_edit'
  | 'queue_edit'
  | 'search'
  | 'download';

export const permits = (permissions: string[] | undefined, permission: Permission): boolean =>
  !!permissions && (permissions.includes('admin') || permissions.includes(permission));

export const hasAccess = (permission: Permission): boolean =>
  permits(useApp.getState().login?.user.permissions, permission);

export const useAccess = () => {
  const permissions = useApp((s) => s.login?.user.permissions);
  return (permission: Permission) => permits(permissions, permission);
};
