# Continuity instructions

Before modifying this repository:

1. Read `PROJECT_MEMORY.md`, `kiber-vengance.md`, `PRODUCT_PLAN.md`, and `README.md`.
2. Check the memory against the code and tests; verified behavior takes precedence if there is a discrepancy.
3. Preserve the official **КИБЕР VENGANCE** identity, the v6 project model (with v2–v5 import compatibility), and the documented UX decisions.
4. Run validation proportional to the change; use `npm run check:full` for complete functional deliveries.
5. After any material change to the product, architecture, UX, shortcuts, exports, or limitations, update `PROJECT_MEMORY.md` and the relevant design document.

Do not declare a feature complete merely because it compiles. Verify the real workflow and honestly document any external limitation.

## Release and validation continuity

- Review `UX_REVIEW.md` and the current reliability/AI/voice documents when changing those workflows. Keep the four workspaces, shared dialogs and existing musical shortcuts.
- Treat project structure, browser-stored binary assets and optional model downloads as separate persistence lifecycles. Project Package must retain referenced take/sample/region IDs and MIME types; JSON is still available for recovery when a binary is missing.
- Keep real inference evidence distinct from worker-protocol UI fixtures and from human listening. Block Service Workers in routed fixture tests. Do not claim singing, a perceptual winner, cold-offline speech startup or physical Safari/Orion output without their corresponding evidence.
- For an authorized release, use reviewable commits per implemented feature/improvement, then rebuild the tracked distribution so its footer identifies the latest runtime source commit. Record checks and deployment results in memory; never record credentials or personal contact details.
- Preserve `.openai/hosting.json`'s Site identity and its current audience/custom domain. GitHub and Sites use separate source histories; synchronize verified tracked files through an isolated Site checkout instead of merging the old Site history into this repository.
