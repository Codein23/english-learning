import { BarChart3, Music4 } from 'lucide-react';
import { PageTitle } from '@/components/ui/PageTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';

/**
 * Écrans du lot suivant. Ils existent déjà comme routes pour que la navigation,
 * les deep-links et l'état actif de la barre soient testables dès maintenant —
 * jamais de lien mort, jamais d'écran vide muet.
 */

export function StatsPage() {
  return (
    <div className="space-y-6">
      <PageTitle
        title="Statistiques"
        description="Courbe de précision, assiduité, verbes les plus ratés, répartition par schéma et par groupe."
      />
      <EmptyState
        icon={BarChart3}
        title="Aucune donnée à afficher pour l'instant"
        description="Les statistiques se construisent à partir des sessions terminées. Elles apparaîtront ici dès que le moteur de quiz sera livré."
        action={
          <ButtonLink to="/quiz" size="sm">
            Voir l'entraînement
          </ButtonLink>
        }
      />
    </div>
  );
}

export function CreditsPage() {
  return (
    <div className="space-y-6">
      <PageTitle
        title="Crédits"
        description="Attributions des enregistrements audio, générées depuis public/audio/manifest.json."
      />
      <EmptyState
        icon={Music4}
        title="Banque audio pas encore construite"
        description="Les enregistrements proviendront de Wikimedia Commons via la Free Dictionary API, sous licence CC. Aucun fichier propriétaire n'est utilisé."
      />
      <section className="prose-measure space-y-2 text-sm text-muted">
        <h2 className="text-sm font-semibold text-ink">Sources pédagogiques</h2>
        <p>
          Tableau des verbes irréguliers <em>by Huito</em> (groupes pédagogiques) et liste des
          100 verbes irréguliers les plus fréquents d'englishpage.com (rangs de fréquence).
          Usage strictement personnel, aucune reproduction commerciale.
        </p>
      </section>
    </div>
  );
}
