# Release runbook — going public & keeping data current

## Permissions

Publishing dataset assets needs **Write** on `frappe/toolbox`. Changing the repo's visibility,
description, and topics needs **Admin** — GitHub returns `HTTP 404` (not 403) for admin actions
your role can't perform, so a 404 on `gh repo edit` means "you are not an admin", not "no repo".

## Go public (one time)

1. **Publish the datasets** (Write access) — uploads the four checksummed assets the app pulls at
   install time. Run from the app root, where `dist/datasets/*.gz` are generated:

   ```bash
   gh release create datasets dist/datasets/*.gz --repo frappe/toolbox \
     --title "Datasets" \
     --notes "Canonical Toolbox datasets, pulled by the fetch-once sync per toolbox/data/manifest.json."
   ```

   Already exists? Replace `create datasets` with `upload datasets` and add `--clobber`.

2. **Set description + topics** (Admin):

   ```bash
   gh repo edit frappe/toolbox \
     --description "Common calculators, converters, lookups, and everyday utilities" \
     --add-topic frappe --add-topic frappe-framework --add-topic vue --add-topic pwa \
     --add-topic calculator --add-topic utilities --add-topic india
   ```

3. **Flip to public** (Admin):

   ```bash
   gh repo edit frappe/toolbox --visibility public --accept-visibility-change-consequences
   ```

   Web UI alternative: Settings → General → Danger Zone → Change repository visibility → Make public.

4. **Verify** the assets are now fetchable without auth (expect a final `HTTP/2 200`):

   ```bash
   curl -sIL https://github.com/frappe/toolbox/releases/download/datasets/pincode-2026-06-10.csv.gz | grep -i "^HTTP"
   ```

   End-to-end on a throwaway site (the `after_migrate` sync pulls + verifies + imports all four):

   ```bash
   bench new-site scratch.localhost --admin-password admin
   bench --site scratch.localhost install-app toolbox
   bench --site scratch.localhost execute toolbox.dataset_sync.sync_datasets
   ```

Existing sites are unaffected — they already have their data. This only enables fresh installs.

## Refreshing a dataset later

- **Automatic** (once public + Actions enabled): `.github/workflows/refresh-datasets.yml` checks
  IFSC (Razorpay) and HSN (India Compliance) monthly and opens a PR with the new asset + manifest.
- **Manual** (PIN, or any one-off): rebuild the asset, upload it, commit the manifest bump:

  ```bash
  python scripts/publish_dataset.py PIN <path>/pincode.csv <version> <source-updated-date>
  gh release upload datasets dist/datasets/<new-asset>.gz --repo frappe/toolbox --clobber
  git add toolbox/data/manifest.json && git commit -m "chore(datasets): refresh PIN" && git push
  ```

The committed manifest pins each asset by SHA-256; a deployment fetches it once per version at
install/update time, verifies it, and imports it. Nothing is sent out — only a GET for public data.
