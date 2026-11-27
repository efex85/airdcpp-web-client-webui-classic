import { withSearch } from '../../../lib/settingsSearch';
import { ExternalLink, links } from '../data';
import { Fields, Note, Page, Section, useRemoteForm } from '../form';
import { settingsPage } from './common';

const SPEED_KEYS = ['download_speed', 'upload_speed'];

const Speed = () => {
  const form = useRemoteForm(SPEED_KEYS);
  return (
    <Page form={form}>
      <Note>
        Set the actual speed of your connection (it is used e.g. for calculating the number of slots). You can measure
        it with <ExternalLink href={links.speedtest}>speedtest.net</ExternalLink>.
      </Note>
      <Fields form={form} keys={SPEED_KEYS} />
    </Page>
  );
};

export const SpeedPage = withSearch(Speed, { keys: SPEED_KEYS, words: 'speedtest' });

const LIMITER_KEYS = ['upload_limit_main', 'download_limit_main'];

export const LimiterPage = settingsPage(LIMITER_KEYS);

/** A group of limits that can be chosen automatically, and limits that are always manual */
const limitsPage = (toggle: string, auto: string[], manual: string[] = []) => {
  const keys = [toggle, ...auto, ...manual];
  const LimitsPage = () => {
    const form = useRemoteForm(keys, { auto: [{ toggle, keys: auto }] });
    return (
      <Page form={form}>
        <Section>
          <Fields form={form} keys={[toggle, ...auto]} />
        </Section>
        {!!manual.length && (
          <Section title="Manually set">
            <Fields form={form} keys={manual} />
          </Section>
        )}
      </Page>
    );
  };

  return withSearch(LimitsPage, { keys });
};

export const DownloadLimitsPage = limitsPage(
  'download_auto_limits',
  ['download_slots', 'download_max_start_speed'],
  ['download_highest_prio_slots'],
);

export const UploadLimitsPage = limitsPage(
  'upload_auto_limits',
  ['upload_slots', 'upload_auto_grant_speed', 'upload_max_granted'],
  ['upload_minislot_size', 'upload_minislot_ext'],
);

export const UserLimitsPage = limitsPage('mcn_auto_limits', ['mcn_down', 'mcn_up']);
