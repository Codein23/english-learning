import { useState } from 'react';
import { AlertTriangle, Check, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDayDelta } from '@/lib/format';
import { isSyncConfigured, useSync } from '@/store/sync';
import { cx } from '@/lib/cx';

/**
 * Réglages de synchronisation.
 *
 * Le compte est une clé secrète, pas un email : rien à retenir, rien à divulguer.
 * La clé reste sur l'appareil, les données partent chiffrées. Perdre la clé sans
 * l'avoir recopiée ailleurs signifie perdre l'accès aux données distantes — c'est
 * dit explicitement à l'écran, au moment où elle est affichée.
 */
export function SyncSettings() {
  const key = useSync((state) => state.key);
  const status = useSync((state) => state.status);
  const lastSyncedAt = useSync((state) => state.lastSyncedAt);
  const lastError = useSync((state) => state.lastError);
  const enable = useSync((state) => state.enable);
  const linkDevice = useSync((state) => state.linkDevice);
  const syncNow = useSync((state) => state.syncNow);
  const disable = useSync((state) => state.disable);
  const forget = useSync((state) => state.forget);

  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [confirmingForget, setConfirmingForget] = useState(false);

  if (!isSyncConfigured) {
    return (
      <Section>
        <p className="text-sm text-muted">
          La synchronisation n'est pas activée sur cette version du site. La progression reste
          enregistrée sur cet appareil.
        </p>
      </Section>
    );
  }

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Presse-papiers refusé : la clé reste sélectionnable à l'écran.
      setCopied(false);
    }
  };

  // La clé fraîchement créée est affichée **au-dessus** des deux branches :
  // sinon l'enregistrement de la clé fait basculer la vue et l'avertissement
  // disparaît avant même d'avoir été lu.
  const freshKeyBlock = freshKey ? (
    <FreshKey value={freshKey} copied={copied} onCopy={() => void copy(freshKey)} onDismiss={() => setFreshKey(null)} />
  ) : null;

  if (key === null) {
    return (
      <Section>
        <p className="prose-measure text-sm text-muted">
          Crée un compte pour retrouver ta progression sur un autre appareil. Pas d'email, pas
          de mot de passe : une clé secrète, générée ici, que tu recopies sur ton second
          appareil. Tes données sont chiffrées avant l'envoi — le serveur ne peut pas les lire.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            loading={status === 'syncing'}
            loadingLabel="Création…"
            onClick={() => {
              void enable()
                .then((created) => {
                  setFreshKey(created);
                  setRevealed(true);
                })
                .catch(() => undefined);
            }}
          >
            Créer un compte
          </Button>
        </div>

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            setLinking(true);
            void linkDevice(input)
              .catch(() => undefined)
              .finally(() => setLinking(false));
          }}
        >
          <label htmlFor="sync-key" className="block text-sm font-medium">
            J'ai déjà une clé
          </label>
          <p className="text-xs text-muted">
            Colle la clé affichée sur ton premier appareil. La progression des deux appareils
            sera fusionnée, rien n'est écrasé.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              id="sync-key"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="XXXXX-XXXXX-XXXXX…"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="h-11 w-full max-w-sm rounded-[var(--radius-field)] border border-border bg-surface px-3 font-mono text-sm placeholder:text-muted hover:border-border-strong"
            />
            <Button type="submit" loading={linking} loadingLabel="Liaison…">
              Rattacher cet appareil
            </Button>
          </div>
        </form>

        {freshKeyBlock}
        <ErrorLine message={lastError} />
      </Section>
    );
  }

  return (
    <Section>
      {freshKeyBlock}

      <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Check aria-hidden="true" className="size-4 text-success-text" strokeWidth={2} />
          Cet appareil est synchronisé
        </p>
        <p className="tnum mt-1 text-xs text-muted">
          Dernière synchronisation : {formatDayDelta(lastSyncedAt)}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code
            className={cx(
              'rounded-[var(--radius-field)] bg-surface-2 px-2 py-1 font-mono text-xs break-all',
              !revealed && 'select-none blur-sm',
            )}
          >
            {key}
          </code>
          <Button size="sm" variant="ghost" onClick={() => setRevealed((value) => !value)}>
            {revealed ? (
              <EyeOff aria-hidden="true" className="size-4" strokeWidth={1.75} />
            ) : (
              <Eye aria-hidden="true" className="size-4" strokeWidth={1.75} />
            )}
            {revealed ? 'Masquer' : 'Afficher la clé'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void copy(key)}>
            <Copy aria-hidden="true" className="size-4" strokeWidth={1.75} />
            {copied ? 'Copiée' : 'Copier'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          loading={status === 'syncing'}
          loadingLabel="Synchronisation…"
          onClick={() => void syncNow()}
        >
          <RefreshCw aria-hidden="true" className="size-4" strokeWidth={2} />
          Synchroniser maintenant
        </Button>
        <Button onClick={disable}>Détacher cet appareil</Button>
      </div>

      {confirmingForget ? (
        <div className="space-y-3 rounded-[var(--radius-card)] border border-danger/40 bg-danger-subtle px-4 py-4">
          <p className="text-sm">
            Supprimer définitivement les données du serveur. La progression de cet appareil
            reste intacte, mais les autres appareils ne pourront plus se resynchroniser.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                void forget();
                setConfirmingForget(false);
              }}
            >
              Supprimer définitivement
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingForget(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="danger" onClick={() => setConfirmingForget(true)}>
          Supprimer les données du serveur
        </Button>
      )}

      <ErrorLine message={lastError} />
    </Section>
  );
}

function FreshKey({
  value,
  copied,
  onCopy,
  onDismiss,
}: {
  value: string;
  copied: boolean;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-warning/40 bg-warning-subtle px-4 py-4">
      <p className="flex items-start gap-2 text-sm font-semibold text-warning-text">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
        Recopie cette clé maintenant
      </p>
      <p className="text-sm">
        C'est le seul moyen d'accéder à ce compte depuis un autre appareil. Personne ne peut la
        régénérer, pas même le serveur : sans elle, les données distantes sont définitivement
        illisibles.
      </p>
      <code className="block rounded-[var(--radius-field)] bg-bg px-3 py-2 font-mono text-sm break-all select-all">
        {value}
      </code>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onCopy}>
          <Copy aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {copied ? 'Clé copiée' : 'Copier la clé'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Je l'ai mise en lieu sûr
        </Button>
      </div>
    </div>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-card)] border border-danger/40 bg-danger-subtle px-4 py-3 text-sm text-danger-text"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      {message}
    </p>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-muted">Synchronisation</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
