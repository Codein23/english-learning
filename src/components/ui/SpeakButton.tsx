import { Volume2 } from 'lucide-react';
import { useAudio } from '@/lib/useAudio';
import { cx } from '@/lib/cx';

/**
 * Bouton haut-parleur. Masqué — pas grisé — si aucune source audio n'existe (§9.2).
 */
export function SpeakButton({
  text,
  sequence,
  label,
  className,
  size = 'md',
}: {
  text?: string;
  sequence?: string[];
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
        else if (text) audio.speak(text);
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
