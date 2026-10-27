import { Link, type Href } from 'expo-router';
import { useQuestDiscovery } from './QuestDiscoveryContext';
import { translate as i18nT } from '@/i18n';
import { buildQuestPath } from '@/utils/routePaths';
import { useThemedColors } from '@/hooks/useTheme';

/** A normal HTML disclosure keeps the complete directory usable without JS. */
export default function QuestDiscoveryDirectory() {
  const discovery = useQuestDiscovery();
  const colors = useThemedColors();
  if (discovery?.view !== 'catalog') return null;
  const label = i18nT('quests:components.home.HomeQuestsPromoSection.vse_kvesty_db15d13b');
  const links = [...discovery.countries, ...discovery.cities, ...discovery.quests.map((quest) => ({
    title: quest.title, path: buildQuestPath(String(quest.city_id), quest.quest_id),
  }))].filter((link): link is { title: string; path: string } => Boolean(link.path));
  return <details data-quest-discovery-directory="true" style={{ marginTop: 24, padding: 16,
    border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, background: colors.surface }}>
    <summary style={{ cursor: 'pointer', minHeight: 44, fontWeight: '700' }}>{label}</summary>
    <nav aria-label={label} lang="ru"><ul style={{ display: 'grid', gap: 12, paddingLeft: 20 }}>
      {links.map((link) => <li key={link.path}><Link href={link.path as Href}
        style={{ color: colors.primaryText, fontSize: 15, lineHeight: 22 }}>{link.title}</Link></li>)}
    </ul></nav>
  </details>;
}
