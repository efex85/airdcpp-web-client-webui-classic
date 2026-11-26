import { useEffect, useState, type ReactNode } from 'react';
import { formatDate, formatDuration, formatSize } from '../../../lib/format';
import { average, formatBitRate, percentage } from '../../../lib/statistics';
import { useApp } from '../../../store/app';
import { socket } from '../../../store/session';
import { ExternalLink, Facts, links, LoadError } from '../data';
import { Page, Section } from '../form';

/** Statistics that are refreshed while the page is shown; null if there is nothing to report */
const useStats = <T,>(path: string, seconds: number) => {
  const generation = useApp((s) => s.generation);
  const [data, setData] = useState<T | null>();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = () =>
      socket.get<T | undefined>(path).then(
        (result) => {
          if (active) {
            setData(result ?? null);
            setError('');
          }
        },
        (e: Error) => active && setError(e.message),
      );

    void load();
    const timer = setInterval(load, seconds * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [path, seconds, generation]);

  return { data, error };
};

const StatsPage = <T,>({
  path,
  seconds,
  empty,
  children,
}: {
  path: string;
  seconds: number;
  empty: string;
  children: (data: T) => ReactNode;
}) => {
  const { data, error } = useStats<T>(path, seconds);
  return (
    <Page>
      <LoadError error={error} />
      {data === undefined ? !error && <div className="muted">Loading…</div> : data === null ? empty : children(data)}
    </Page>
  );
};

export const ApplicationPage = () => {
  const info = useApp((s) => s.login?.system_info);
  const { data } = useStats<{ active_sessions: number; server_threads: number }>('system/stats', 5);
  return (
    <Page>
      <Facts
        rows={[
          ['Application version', info?.client_version],
          ['Web interface', 'AirDC++ Classic'],
          ['API version', info?.api_version],
          ['API feature level', info?.api_feature_level],
          ['Started', formatDate(info?.client_started)],
          ['Active sessions', data?.active_sessions],
          ['Server threads', data?.server_threads],
        ]}
      />
      <Section title="Resources">
        <p>
          <ExternalLink href={links.home}>Home page</ExternalLink>
        </p>
        <p>
          <ExternalLink href={links.help}>Documentation</ExternalLink>
        </p>
        <p>
          <ExternalLink href={links.issues}>Feature request / bug tracker</ExternalLink>
        </p>
      </Section>
      <Section title="Third-party credits">
        <p>
          <ExternalLink href={links.dbip}>IP Geolocation by DB-IP</ExternalLink>
        </p>
      </Section>
    </Page>
  );
};

interface TransferredBytes {
  session_downloaded: number;
  session_uploaded: number;
  start_total_downloaded: number;
  start_total_uploaded: number;
}

const bytes = (value: number) => formatSize(value) || '0 B';

export const TransferStatsPage = () => (
  <StatsPage<TransferredBytes> path="transfers/transferred_bytes" seconds={5} empty="No statistics">
    {(s) => (
      <>
        <Facts
          rows={[
            ['Total downloaded', bytes(s.session_downloaded + s.start_total_downloaded)],
            ['Total uploaded', bytes(s.session_uploaded + s.start_total_uploaded)],
          ]}
        />
        <Section title="Session">
          <Facts
            rows={[
              ['Session downloaded', bytes(s.session_downloaded)],
              ['Session uploaded', bytes(s.session_uploaded)],
            ]}
          />
        </Section>
      </>
    )}
  </StatsPage>
);

type Numbers = Record<string, number>;

export const ShareStatsPage = () => (
  <StatsPage<Numbers> path="share/stats" seconds={60} empty="No files shared">
    {(s) => (
      <>
        <Facts
          rows={[
            ['Total share size', bytes(s.total_size)],
            ['Total files', `${s.total_file_count} (${percentage(s.unique_file_count, s.total_file_count)} unique)`],
            ['Total directories', s.total_directory_count],
            ['Average file age', formatDuration(s.average_file_age) || '-'],
            ['Average files per directory', average(s.total_file_count, s.total_directory_count)],
          ]}
        />
        <Section title="Incoming searches">
          <Facts
            rows={[
              ['Total searches', `${s.total_searches} (${s.total_searches_per_second.toFixed(1)} per second)`],
              ['TTH searches', percentage(s.tth_searches, s.total_searches)],
              [
                'Text searches',
                `${s.recursive_searches} (${s.unfiltered_recursive_searches_per_second.toFixed(2)} matched per second)`,
              ],
              [
                'Filtered text searches',
                `${percentage(s.filtered_searches, s.recursive_searches)} (${percentage(
                  s.recursive_searches_responded,
                  s.recursive_searches - s.filtered_searches,
                )} of the matched ones returned results)`,
              ],
              [
                'Average text search tokens (non-filtered)',
                `${s.average_search_token_count.toFixed(1)} (${s.average_search_token_length.toFixed(1)} bytes per token)`,
              ],
              ['Average matching time per text search', `${s.average_match_ms} ms`],
            ]}
          />
        </Section>
      </>
    )}
  </StatsPage>
);

interface HubStats {
  total_users: number;
  unique_users: number;
  active_users: number;
  total_share: number;
  adc_down_per_user: number;
  adc_up_per_user: number;
  clients: { name: string; count: number }[];
}

export const HubStatsPage = () => (
  <StatsPage<HubStats> path="hubs/stats" seconds={10} empty="No hubs online">
    {(s) => (
      <>
        <Facts
          rows={[
            ['Total users', s.total_users],
            ['Unique users', `${s.unique_users} (${percentage(s.unique_users, s.total_users)})`],
            ['Active users', `${s.active_users} (${percentage(s.active_users, s.unique_users)})`],
            ['Total share', bytes(s.total_share)],
            ['Average share per user', bytes(s.unique_users ? Math.round(s.total_share / s.unique_users) : 0)],
            ['Average ADC download speed', formatBitRate(s.adc_down_per_user) || '-'],
            ['Average ADC upload speed', formatBitRate(s.adc_up_per_user) || '-'],
          ]}
        />
        <Section title="Clients">
          <Facts
            rows={s.clients.map((c) => [c.name, `${c.count} (${percentage(c.count, s.unique_users)})`])}
          />
        </Section>
      </>
    )}
  </StatsPage>
);
