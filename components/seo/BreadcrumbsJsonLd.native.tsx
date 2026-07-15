import type { BreadcrumbModel } from '@/hooks/useBreadcrumbModel';

type BreadcrumbsJsonLdProps = {
  model?: BreadcrumbModel;
  pathname?: string | null;
};

// JSON-LD is only consumed by web crawlers. Rendering expo-router Head on
// native requires a hosted origin and can fail before the app UI mounts.
export default function BreadcrumbsJsonLd(_props: BreadcrumbsJsonLdProps) {
  return null;
}
