// Menu items provided by the daemon: hub user commands and extension actions
import type { FormDefinition, MenuGroup, MenuItem } from '../api/types';
import { reportError } from '../store/app';
import { socket } from '../store/session';
import { showDialog, type Field, type MenuEntry } from '../store/ui';

const SUPPORTS = ['urls', 'form'];

const toField = (definition: FormDefinition): Field => {
  const options = definition.options?.map((o) => ({ value: o.id as string | number, label: o.name }));
  return {
    key: definition.key,
    label: definition.title,
    value: definition.default_value,
    required: !definition.optional,
    options,
    type: options
      ? 'select'
      : definition.type === 'boolean'
        ? 'boolean'
        : definition.type === 'number'
          ? 'number'
          : definition.type === 'text'
            ? 'textarea'
            : 'text',
  };
};

export const remoteMenu = async (
  menuId: string,
  selectedIds: unknown[],
  entityId?: string | number,
): Promise<MenuEntry[]> => {
  const base = { selected_ids: selectedIds, entity_id: entityId, supports: SUPPORTS };
  const groups = await socket.post<MenuGroup[]>(`menus/${menuId}/list_grouped`, base);

  const select = async (item: MenuItem) => {
    if (item.urls?.length) {
      for (const url of item.urls) {
        if (/^https?:\/\//i.test(url)) {
          window.open(url, '_blank', 'noopener');
        }
      }

      return;
    }

    let values: Record<string, unknown> | undefined;
    if (item.form_definitions?.length) {
      const result = await showDialog({
        title: item.title,
        fields: item.form_definitions.map(toField),
        confirmLabel: 'Send',
      });

      if (!result) {
        return;
      }

      values = result;
    }

    await socket
      .post(`menus/${menuId}/select`, {
        ...base,
        hook_id: item.hook_id,
        menuitem_id: item.id,
        form_definitions: item.form_definitions,
        form_value: values,
      })
      .catch(reportError(item.title));
  };

  const toEntry = (item: MenuItem): MenuEntry => ({
    label: item.title,
    children: item.children?.length ? item.children.map(toEntry) : undefined,
    onClick: item.children?.length ? undefined : () => void select(item),
  });

  return groups.map((group) => ({ label: group.title, children: group.items.map(toEntry) }));
};
