import { useEffect, useState } from 'react';
import { ExternalLink, Music4 } from 'lucide-react';
import { PageTitle } from '@/components/ui/PageTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCount } from '@/lib/format';

/**
 * Attributions des enregistrements, générées depuis `public/audio/manifest.json`.
 * Obligatoire pour les licences CC-BY et CC-BY-SA : chaque contributeur est cité,
 * avec sa licence et un lien vers le fichier d'origine sur Wikimedia Commons.
 */

interface AudioSource {
  author?: string | null;
  license?: string | null;
  licenseUrl?: string | null;
  sourceUrl?: string | null;
}

interface Manifest {
  generatedAt?: string;
  forms: Record<string, { us?: AudioSource; uk?: AudioSource; any?: AudioSource }>;
}

interface Attribution {
  author: string;
  license: string;
  licenseUrl: string | null;
  count: number;
  sample: string | null;
}

export function CreditsPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${import.meta.env.BASE_URL}audio/manifest.json`)
      .then((response) => (response.ok ? (response.json() as Promise<Manifest>) : null))
      .catch(() => null)
      .then((loaded) => {
        if (cancelled) return;
        setManifest(loaded);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const attributions = groupAttributions(manifest);
  const recordings = manifest
    ? Object.values(manifest.forms).reduce(
        (sum, entry) => sum + (entry.us ? 1 : 0) + (entry.uk ? 1 : 0) + (entry.any ? 1 : 0),
        0,
      )
    : 0;

  return (
    <div className="space-y-8">
      <PageTitle
        title="Crédits"
        description="Les enregistrements de prononciation proviennent de Wikimedia Commons, sous licences Creative Commons. Aucun fichier propriétaire n'est utilisé."
      />

      {loading ? (
        <ul className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <li
              key={index}
              className="h-14 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface"
            />
          ))}
        </ul>
      ) : attributions.length === 0 ? (
        <EmptyState
          icon={Music4}
          title="Banque audio non disponible"
          description="Aucun enregistrement n'est embarqué dans cette version : la prononciation est assurée par la synthèse vocale du navigateur, qui ne nécessite aucune attribution."
        />
      ) : (
        <section aria-labelledby="attributions" className="space-y-3">
          <h2 id="attributions" className="text-sm font-semibold text-muted">
            {formatCount(recordings)} enregistrements · {formatCount(attributions.length)}{' '}
            contributeurs
          </h2>

          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
            {attributions.map((attribution) => (
              <li
                key={`${attribution.author}-${attribution.license}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface px-4 py-3"
              >
                <span className="font-medium">{attribution.author}</span>
                {attribution.licenseUrl ? (
                  <a
                    href={attribution.licenseUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-sm text-accent-text underline underline-offset-2"
                  >
                    {attribution.license}
                    <ExternalLink aria-hidden="true" className="size-3" strokeWidth={1.75} />
                  </a>
                ) : (
                  <span className="text-sm text-muted">{attribution.license}</span>
                )}
                <span className="tnum ml-auto text-sm text-muted">
                  {formatCount(attribution.count)}{' '}
                  {attribution.count > 1 ? 'enregistrements' : 'enregistrement'}
                </span>
                {attribution.sample ? (
                  <a
                    href={attribution.sample}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs text-muted underline underline-offset-2 hover:text-ink"
                  >
                    voir sur Commons
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="prose-measure space-y-2 text-sm text-muted">
        <h2 className="text-sm font-semibold text-ink">Sources pédagogiques</h2>
        <p>
          Tableau des verbes irréguliers <em>by Huito</em> (groupes pédagogiques et liste
          exhaustive) et liste des 100 verbes irréguliers les plus fréquents d'englishpage.com
          (rangs de fréquence). Usage strictement personnel, aucune reproduction commerciale.
        </p>
        <h2 className="text-sm font-semibold text-ink">Prononciation de repli</h2>
        <p>
          Les formes sans enregistrement humain sont lues par la synthèse vocale du système
          (Web Speech API). Elle ne nécessite aucune attribution, mais reste moins fidèle
          qu'une voix enregistrée.
        </p>
      </section>
    </div>
  );
}

function groupAttributions(manifest: Manifest | null): Attribution[] {
  if (!manifest) return [];

  const groups = new Map<string, Attribution>();

  for (const entry of Object.values(manifest.forms)) {
    for (const source of [entry.us, entry.uk, entry.any]) {
      // Un enregistrement sans auteur connu ne peut pas être attribué : il est
      // compté sous une mention explicite plutôt que passé sous silence.
      if (!source) continue;
      const author = source.author?.trim() || 'Contributeur non identifié';
      const license = source.license?.trim() || 'Licence non précisée';
      const key = `${author}|${license}`;

      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      groups.set(key, {
        author,
        license,
        licenseUrl: source.licenseUrl ?? null,
        count: 1,
        sample: source.sourceUrl ?? null,
      });
    }
  }

  return [...groups.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.author.localeCompare(b.author);
  });
}
