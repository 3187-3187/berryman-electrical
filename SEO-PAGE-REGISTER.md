# Berryman Electrical — SEO Page Register

Created: 23 October 2026. **Published to the production GitHub branch `seo-first-wave-v1` on 23 October 2026.** Release PR #4 merged at commit `e88704d24941e2effa50c64d144909164ba420fb`; Cloudflare Pages reported a successful deployment of that commit. Live HTTP fetching and search engine indexing are tracked separately.

| New page | Primary search topic | Secondary search intent | Status |
| --- | --- | --- | --- |
| /services/underground-power-submains/ | underground power Byron Bay | submain electrician, shed power, outbuilding power | Released 23 Oct 2026 |
| /services/commercial-electrical-maintenance/ | commercial electrical maintenance Byron Bay | electrical maintenance contractor, commercial repairs | Released 23 Oct 2026 |
| /services/smoke-alarm-installation/ | smoke alarm certification Byron Bay | smoke alarm compliance, residential checks, commercial accredited partner sign-off and hard-wired installation | Released 23 Oct 2026 |
| /services/hot-water-electrical-repairs/ | hot water electrician Byron Bay | electric hot water not heating, hot water breaker tripping | Released 23 Oct 2026 |

## Batch 2 — Draft pages (23 October 2026)

Batch 2 is on isolated review branch `seo-batch2-service-pages-20261023` and **not published**. User confirmed they hold a data cabling registration; the communications page does not claim an unverified registration number or specialised endorsements.

| New page | Primary search topic | Secondary search intent | Status |
| --- | --- | --- | --- |
| /services/strata-property-manager-electrician/ | strata electrician Byron Bay | property manager electrician, common area lighting, strata maintenance | Draft — review |
| /services/pump-controls-automation/ | pump control electrician Byron Bay | industrial pump controls, wastewater control panels, starters, electrical telemetry fault finding | Draft — review |
| /services/house-rewiring-new-home-wiring/ | house rewiring Byron Bay | new home electrical wiring, full rewiring, partial rewires, rough-ins | Draft — review |
| /services/data-communications-cabling/ | data cabling Byron Bay | registered cabler, CAT6, Ethernet points, structured cabling | Draft — review |

Finalise scope, test on mobile/tablet/desktop, check data registration scope and genuine photo captions, and confirm Cloudflare deployment controls before a release.

Release checks: GitHub's browser QA on mobile, tablet and desktop passed for the new pages in the review branch. All four new canonical URLs appear in the production branch sitemap (29 URLs total). Cloudflare Pages build/deployment succeeded on the merge commit. Individual live custom-domain HTTP responses and Google indexation were not independently confirmed through this workspace. Optional real job photos can be added after the launch.

Post-launch: monitor Google Search Console query and page impressions, clicks, CTR, average position and attributable enquiries. Record meaningful changes monthly and avoid inferring rankings from page existence alone. The separate `berryman-gsc-bridge` Cloudflare Worker showed a build failure at release; it was not the successful Cloudflare Pages website deployment.
