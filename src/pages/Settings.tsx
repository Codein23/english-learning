import { useId, useState } from 'react';
import { AlertTriangle, Check, Info } from 'lucide-react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Button } from '@/components/ui/Button';
import { SyncSettings } from '@/components/SyncSettings';
import { isPersistenceAvailable } from '@/lib/storage';
import { useSettings, type Accent, type ThemePreference, type TtsAccent } from '@/store/settings';
import { useProgress } from '@/store/progress';
import { cx } from '@/lib/cx';

export function SettingsPage() {
  const theme = useSettings((state) => state.theme);
  const setTheme = useSettings((state) => state.setTheme);
  const accent = useSettings((state) => state.accent);
  const setAccent = useSettings((state) => state.setAccent);
  const ttsAccent = useSettings((state) => state.ttsAccent);
  const setTtsAccent = useSettings((state) => state.setTtsAccent);
  const volume = useSettings((state) => state.volume);
  const setVolume = useSettings((state) => state.setVolume);
  const autoPlayAudio = useSettings((state) => state.autoPlayAudio);
  const setAutoPlayAudio = useSettings((state) => state.setAutoPlayAudio);

  const reset = useProgress((state) => state.reset);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const volumeId = useId();

  return (
    <div className="space-y-8">
      <PageTitle
        title="Réglages"
        description="Tout est enregistré sur cet appareil uniquement. Aucun compte, aucune synchronisation."
      />

      {!isPersistenceAvailable ? (
        <p className="flex items-start gap-2 rounded-[var(--radius-card)] border border-warning/40 bg-warning-subtle px-4 py-3 text-sm text-warning-text">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          Le stockage local est indisponible sur ce navigateur : la progression sera perdue à
          la fermeture de l'onglet. L'entraînement reste utilisable.
        </p>
      ) : null}

      <Section title="Apparence">
        <Choice<ThemePreference>
          label="Thème"
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'system', label: 'Système' },
            { value: 'light', label: 'Clair' },
            { value: 'dark', label: 'Sombre' },
          ]}
        />
      </Section>

      <Section title="Audio">
        <Choice<Accent>
          label="Accent des enregistrements"
          value={accent}
          onChange={setAccent}
          options={[
            { value: 'us', label: 'Américain (US)' },
            { value: 'uk', label: 'Britannique (UK)' },
          ]}
        />

        <Choice<TtsAccent>
          label="Accent du TTS de secours"
          value={ttsAccent}
          onChange={setTtsAccent}
          options={[
            { value: 'us', label: 'Américain (en-US)' },
            { value: 'uk', label: 'Britannique (en-GB)' },
          ]}
        />

        <div className="space-y-2">
          <label htmlFor={volumeId} className="text-sm font-medium">
            Volume
          </label>
          <div className="flex items-center gap-3">
            <input
              id={volumeId}
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(volume * 100)}
              onChange={(event) => setVolume(Number(event.target.value) / 100)}
              className="h-11 w-full max-w-xs accent-[var(--color-accent)]"
            />
            <output htmlFor={volumeId} className="tnum w-12 text-sm text-muted">
              {Math.round(volume * 100)} %
            </output>
          </div>
        </div>

        <Toggle
          label="Lecture automatique"
          description="Prononce la bonne forme au moment où la correction s'affiche."
          checked={autoPlayAudio}
          onChange={setAutoPlayAudio}
        />

        <p className="flex items-start gap-2 text-xs text-muted">
          <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
          Les prononciations natives `US/UK` sont prioritaires. Si aucune n’est fiable, l’application bascule sur le TTS de secours choisi ici.
        </p>
      </Section>

      <SyncSettings />

      <Section title="Données">
        {confirmingReset ? (
          <div className="space-y-3 rounded-[var(--radius-card)] border border-danger/40 bg-danger-subtle px-4 py-4">
            <p className="text-sm">
              Effacer toute la progression : tentatives, boîtes SRS, favoris et historique de
              sessions. Cette action est définitive.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  reset();
                  setConfirmingReset(false);
                }}
              >
                Effacer définitivement
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingReset(false)}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="danger" onClick={() => setConfirmingReset(true)}>
            Réinitialiser la progression
          </Button>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={cx(
                'inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors duration-150 ease-out',
                active
                  ? 'border-accent bg-accent-subtle text-accent-text'
                  : 'border-border bg-surface text-muted hover:border-border-strong hover:text-ink',
              )}
            >
              {active ? (
                <Check aria-hidden="true" className="size-4" strokeWidth={2} />
              ) : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-5 accent-[var(--color-accent)]"
      />
      <label htmlFor={id} className="space-y-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{description}</span>
      </label>
    </div>
  );
}
