-- Base D1 de synchronisation.
-- Le serveur ne stocke qu'un blob chiffré côté client : il ne peut pas lire la
-- progression. Aucune donnée personnelle, aucun email, aucun mot de passe.

CREATE TABLE IF NOT EXISTS accounts (
  -- Identifiant public dérivé de la clé de synchronisation (16 octets hex).
  id TEXT PRIMARY KEY,
  -- SHA-256 du jeton d'authentification. Le jeton lui-même n'est jamais stocké.
  token_hash TEXT NOT NULL,
  -- Version incrémentale : sert à détecter les écritures concurrentes.
  version INTEGER NOT NULL DEFAULT 0,
  -- Payload chiffré (AES-GCM), opaque pour le serveur.
  blob TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Purge possible des comptes jamais synchronisés : index sur la date de MAJ.
CREATE INDEX IF NOT EXISTS accounts_updated_at ON accounts (updated_at);
