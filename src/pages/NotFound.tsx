import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export function NotFoundPage({
  title = 'Page introuvable',
  description = "Cette adresse ne correspond à aucun écran de l'application.",
  backTo = '/',
  backLabel = "Retour à l'accueil",
}: {
  title?: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="py-8">
      <EmptyState
        icon={Compass}
        title={title}
        description={description}
        action={
          <ButtonLink to={backTo} size="sm">
            {backLabel}
          </ButtonLink>
        }
      />
    </div>
  );
}
