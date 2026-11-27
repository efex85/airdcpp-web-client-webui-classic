// Pages that only list settings of the client
import { withSearch } from '../../../lib/settingsSearch';
import { Fields, Page, Section, useRemoteForm } from '../form';

type Group = [title: string | undefined, keys: string[]];

export const groupedPage = (groups: Group[]) => {
  const keys = groups.flatMap(([, list]) => list);
  const GroupedPage = () => {
    const form = useRemoteForm(keys);
    return (
      <Page form={form}>
        {groups.map(([title, list]) => (
          <Section key={title ?? list[0]} title={title}>
            <Fields form={form} keys={list} />
          </Section>
        ))}
      </Page>
    );
  };

  return withSearch(GroupedPage, {
    keys,
    items: groups.flatMap(([title]) => (title ? [{ title }] : [])),
    // A setting is also found by the title of its group
    describe: (key) => ({ words: groups.find(([, list]) => list.includes(key))?.[0] }),
  });
};

export const settingsPage = (keys: string[]) => {
  const SettingsPage = () => {
    const form = useRemoteForm(keys);
    return (
      <Page form={form}>
        <Fields form={form} keys={keys} />
      </Page>
    );
  };

  return withSearch(SettingsPage, { keys });
};
