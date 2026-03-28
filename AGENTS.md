# AGENTS.md — ha-timeline-card

## GitHub Token

Ce repo utilise un token GitHub dédié stocké localement dans `.gh-token` (gitignored).

Avant toute commande `gh` (release, PR, issue...), sourcer le token :

```bash
source .gh-token
```

Le fichier `.gh-token` contient :
```
export GH_TOKEN=ghp_xxxxx...
```

Ce fichier est local uniquement, jamais versionné. Le token global de `secrets.env` n'est pas utilisé pour ce repo.

## Repo

- **GitHub** : https://github.com/ozirissp/ha-timeline-card
- **Branche principale** : `main`

## Releases

Pour créer une release :
```bash
source .gh-token
gh release create v0.x.0 ha-timeline-card.js --title "v0.x.0" --notes "Description des changements"
```

## Contexte projet

Custom card Home Assistant — frise temporelle horizontale générique multi-calendriers pour Lovelace.

- **Fichier principal** : `ha-timeline-card.js` (vanilla JS, fichier unique, pas de bundler)
- **Custom element** : `ha-timeline-card`
- **HACS** : `hacs.json` présent, `content_in_root: true`
- **Ne pas committer** sans demande explicite
