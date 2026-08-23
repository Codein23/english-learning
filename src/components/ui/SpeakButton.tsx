import { Volume2 } from 'lucide-react';
import type { VerbForm } from '@/data/schema';
import { useAudio } from '@/lib/useAudio';
import { cx } from '@/lib/cx';

/**
 * Bouton haut-parleur. Masqué — pas grisé — si aucune source audio n'existe (§9.2).
 * Le `role` sert aux homographes hétérophones : `read` au prétérit n'a pas le
 * même enregistrement que `read` à la base.
 */
export function SpeakButton({
  text,
  role,
  sequence,
  label,
  className,
  size = 'md',
}: {
  text?: string;
  role?: VerbForm;
  sequence?: { text: string; role?: VerbForm }[];
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const audio = useAudio();
  if (!audio.available) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (sequence && sequence.length > 0) audio.speakSequence(sequence);
        else if (text) audio.speak(text, role ? { role } : {});
      }}
      className={cx(
        'grid shrink-0 place-items-center rounded-full text-muted transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-ink',
        size === 'sm' ? 'size-9' : 'size-11',
        className,
      )}
    >
      <Volume2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
      <span className="sr-only">{label}</span>
    </button>
  );
}
