# Public repository data audit

2026-10-30. The user requested this review after making the repository public.

## Result

**No real credentials or sensitive contact information were detected in the reviewed repository content, Git history or published wiki.**

Gitleaks reported two `generic-api-key` candidates in `src/ui/locales/en.json`, originating in commit `8e0451e`. Both were confirmed to be generated translation identifiers (`ui_…`) used as dictionary keys, not access tokens. No broad file exclusion or suppression was added.

## Scope and evidence

- Official **Gitleaks 8.30.1**, downloaded from its upstream release and verified against the published SHA-256 before use. Scanning ran locally; source was not sent to a scanning service.
- Current tracked-file snapshot, including source, configuration, generated distribution and documentation.
- All reachable repository history using `--all --full-history -m`, including merge-parent diffs; the only matches were the two translation IDs above.
- Published wiki files/history: zero secret findings.
- Current filenames: no versioned environment, private-key or credential-store files found.
- Main repository and wiki commit metadata: only noreply email identities. A separate bounded email/contact-pattern pass found no non-placeholder contact candidates in current text or historical patches.
- The four documentation screenshots were visually reviewed: demo/test UI, with no credentials or personal contact fields. Their PNG structures contain no text/EXIF metadata chunks.
- Reports and logs stayed outside the repository. Reports were redacted; no candidate values are reproduced here. No credentials were rotated and no Git history was rewritten because no real secret was found.

## Reproduce the pattern scans

```sh
gitleaks git . --log-opts='--all --full-history -m' --ignore-gitleaks-allow --redact=100
gitleaks dir /path/to/tracked-file-snapshot --ignore-gitleaks-allow --redact=100
```

These are pattern-based results, not a guarantee that every possible sensitive datum can be recognized. Ignored local user data/model directories are outside the published repository and were not included. No live credential verification was attempted.

Tool source: [official Gitleaks release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1).
