# romar.nathoe.nl

Persoonlijke website van Romar Nathoe: https://romar.nathoe.nl

Handgeschreven HTML, CSS en vanilla JavaScript (ES modules), zonder framework en zonder build-stap.

## Structuur

```
public/            alles wat live gaat
  index.html       one-pager
  overmij.html     redirect naar /#over (oude URL)
  contact.html     redirect naar /#contact (oude URL)
  404.html
  assets/css/main.css
  assets/js/       main.js, contours.js (hero-canvas), palette.js (Ctrl/⌘+K)
  assets/img/      geoptimaliseerde AVIF/WebP
  Bestanden/       certificaten (PDF)
bron-foto/         originele foto's (worden niet gedeployd)
scripts/deploy.sh  deploy naar AWS
```

## Lokaal draaien

```bash
python -m http.server 8080 -d public
# open http://localhost:8080
```

## Deployen

Hosting: S3-bucket `romar.nathoe.nl` achter CloudFront, op het **privé** AWS-account.

```bash
./scripts/deploy.sh --dry-run   # bekijk wat er verandert
./scripts/deploy.sh             # deploy (vraagt bevestiging)
```

Het script gebruikt altijd AWS-profiel `prive`, negeert `AWS_PROFILE` uit de shell
(die staat op het werk-account) en stopt als het account-ID niet klopt.

## Sneltoetsen op de site

- `Ctrl/⌘ + K` of `/`: command palette
- `T`: thema wisselen
- `g` `h`: naar boven
