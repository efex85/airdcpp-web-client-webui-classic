import { ExternalLink, links } from '../data';
import { Fields, Note, Page, Section, useRemoteForm } from '../form';

const SPEED_KEYS = ['download_speed', 'upload_speed'];

export const SpeedPage = () => {
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

const LIMITER_KEYS = ['upload_limit_main', 'download_limit_main'];

export const LimiterPage = () => {
  const form = useRemoteForm(LIMITER_KEYS);
  return (
    <Page form={form}>
      <Fields form={form} keys={LIMITER_KEYS} />
    </Page>
  );
};

/** A group of limits that can be chosen automatically, and limits that are always manual */
const LimitsPage = ({ toggle, auto, manual = [] }: { toggle: string; auto: string[]; manual?: string[] }) => {
  const keys = [toggle, ...auto, ...manual];
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

export const DownloadLimitsPage = () => (
  <LimitsPage
    toggle="download_auto_limits"
    auto={['download_slots', 'download_max_start_speed']}
    manual={['download_highest_prio_slots']}
  />
);

export const UploadLimitsPage = () => (
  <LimitsPage
    toggle="upload_auto_limits"
    auto={['upload_slots', 'upload_auto_grant_speed', 'upload_max_granted']}
    manual={['upload_minislot_size', 'upload_minislot_ext']}
  />
);

export const UserLimitsPage = () => <LimitsPage toggle="mcn_auto_limits" auto={['mcn_down', 'mcn_up']} />;
