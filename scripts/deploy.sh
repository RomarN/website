#!/usr/bin/env bash
# Deploy romar.nathoe.nl naar het PRIVÉ AWS-account (S3 + CloudFront).
#
# Gebruik:
#   ./scripts/deploy.sh            # toont plan, vraagt bevestiging, deployt
#   ./scripts/deploy.sh --dry-run  # laat alleen zien wat er zou veranderen
#   ./scripts/deploy.sh --yes      # zonder bevestigingsvraag
#
# Veiligheid: dit script negeert AWS_PROFILE / AWS_ACCESS_KEY_ID uit je shell
# (die staan standaard op het werk-account) en stopt als het account-ID niet
# exact het privé-account is.

set -euo pipefail

readonly AWS_PROFILE_NAME="prive"
readonly EXPECTED_ACCOUNT_ID="621402808766"
readonly BUCKET="romar.nathoe.nl"
readonly DISTRIBUTION_ID="E2FXG6BV103HNM"
readonly REGION="eu-west-1"

DRY_RUN=""
ASSUME_YES="false"
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dryrun" ;;
    --yes|-y) ASSUME_YES="true" ;;
    *) echo "Onbekende optie: $arg" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."
readonly SITE_DIR="public"
[[ -f "$SITE_DIR/index.html" ]] || { echo "Geen $SITE_DIR/index.html gevonden" >&2; exit 1; }

# Credentials uit de omgeving uitschakelen: alleen het expliciete profiel telt.
unset AWS_PROFILE AWS_DEFAULT_PROFILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
aws_prive() { aws --profile "$AWS_PROFILE_NAME" --region "$REGION" "$@"; }

echo "→ Account controleren (profiel: $AWS_PROFILE_NAME)"
ACCOUNT_ID="$(aws_prive sts get-caller-identity --query Account --output text)"
if [[ "$ACCOUNT_ID" != "$EXPECTED_ACCOUNT_ID" ]]; then
  echo "✗ STOP: verbonden met account $ACCOUNT_ID, verwacht $EXPECTED_ACCOUNT_ID (privé)." >&2
  exit 1
fi

ALIAS="$(aws_prive cloudfront get-distribution --id "$DISTRIBUTION_ID" \
  --query 'Distribution.DistributionConfig.Aliases.Items[0]' --output text)"
if [[ "$ALIAS" != "$BUCKET" ]]; then
  echo "✗ STOP: CloudFront $DISTRIBUTION_ID hoort bij '$ALIAS', niet bij $BUCKET." >&2
  exit 1
fi

echo "✓ Account $ACCOUNT_ID · bucket s3://$BUCKET · CloudFront $DISTRIBUTION_ID ($ALIAS)"

if [[ -z "$DRY_RUN" && "$ASSUME_YES" != "true" ]]; then
  echo
  echo "Let op: --delete verwijdert bestanden uit de bucket die niet in $SITE_DIR/ staan."
  read -r -p "Deployen naar https://$BUCKET ? [j/N] " answer
  [[ "$answer" =~ ^[jJyY]$ ]] || { echo "Afgebroken."; exit 0; }
fi

# 1. Afbeeldingen en PDF's: lang cachen (bestandsnamen wijzigen bij nieuwe versie)
echo "→ Sync statische bestanden"
aws_prive s3 sync "$SITE_DIR" "s3://$BUCKET" $DRY_RUN --delete \
  --exclude "*.html" --exclude "*.css" --exclude "*.js" --exclude "*.xml" --exclude "*.txt" \
  --cache-control "public, max-age=2592000"

# 2. CSS/JS: kort cachen (geen hashes in bestandsnamen)
echo "→ Sync CSS/JS"
aws_prive s3 sync "$SITE_DIR" "s3://$BUCKET" $DRY_RUN --delete \
  --exclude "*" --include "*.css" --include "*.js" \
  --cache-control "public, max-age=3600, must-revalidate"

# 3. HTML, sitemap, robots: altijd revalideren
echo "→ Sync HTML"
aws_prive s3 sync "$SITE_DIR" "s3://$BUCKET" $DRY_RUN --delete \
  --exclude "*" --include "*.html" --include "*.xml" --include "*.txt" \
  --cache-control "no-cache"

if [[ -n "$DRY_RUN" ]]; then
  echo "✓ Dry-run klaar, niets gewijzigd."
  exit 0
fi

# 404-pagina als error document (idempotent)
aws_prive s3api put-bucket-website --bucket "$BUCKET" \
  --website-configuration '{"IndexDocument":{"Suffix":"index.html"},"ErrorDocument":{"Key":"404.html"}}'

echo "→ CloudFront cache legen"
INVALIDATION_ID="$(aws_prive cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" --query 'Invalidation.Id' --output text)"

echo "✓ Live: https://$BUCKET  (invalidation $INVALIDATION_ID, duurt ~1 min)"
