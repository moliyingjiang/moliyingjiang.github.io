# 许源知 · Yuanzhi Xu · Academic Website

Personal academic website covering research, engineering projects, education, and competition experience.

- Website: https://blog.dengshu.cloud/
- First-time visitors to the public custom domain are routed by IP region: mainland China (`CN`) to Chinese, other regions to English. English is the fallback; explicit Chinese links remain Chinese.
- GitHub is the source repository; Gitee is its synchronized mirror.
- Hosting is GitHub Pages, with Cloudflare in front of the custom domain.

## Pages

Home, News, Research, Projects, Awards, and CV have English and Chinese versions. Detailed undergraduate and graduate records are linked from CV. The homepage news section uses a fixed-height, manually scrollable region.

## Language selection

The shared `assets/js/language-routing.mjs` reads the country field from the existing, same-origin Cloudflare `/cdn-cgi/trace` endpoint. It never stores IP addresses or sends them to an additional geolocation service. `CN` selects Chinese; `HK`, `MO`, `TW`, and other located regions select English. A VPN or proxy changes the apparent region. The request has a 1.8-second timeout, and an unavailable or unknown location leaves the English page in place. Automatic results are cached for one hour in the tab session; failures for five minutes.

The Language link records a manual preference in the current browser and carries an explicit `?lang=en` or `?lang=zh` marker. An explicit query overrides detection; a direct Chinese URL stays Chinese for that visit; otherwise a saved manual preference takes priority over IP detection. Queries, fragments, and the corresponding page are preserved, including both electronic CV routes. With browser storage disabled, the URL carries the choice through same-language navigation. The editor, its iframe previews, PDFs, local previews, and GitHub's non-Cloudflare origin do not make geolocation requests. The script is retained by the web editor's normal content publishing process.

## Editing

This is a static HTML/CSS site with no build step. Shared navigation and document styling is in `assets/css/site-shell.css`; homepage and inner-page layouts use their existing CSS files. Keep navigation and language counterparts consistent when adding a page.

Use the web editor at https://blog.dengshu.cloud/admin/ to maintain personal details, bilingual News, awards, publications, and projects. The personal-details form controls public names, biography, schools, advisors, research directions, portrait, academic links, and CV links. Preview opens the selected record's page; linked News can be updated alongside its source record. Drafts stay on the current device until publication or export. GitHub is the source, and the main branch is automatically mirrored to Gitee.

Personal details live in `assets/data/profile.json`; News in `assets/data/news.json`; publications, projects, awards, and aggregate totals in `assets/data/portfolio.json`. `node scripts/render-site.mjs` emits an apply_patch patch for all generated pages, including homepage research counts and electronic undergraduate/graduate records. Apply that patch, then run `npm run check` and `npm test`. `--file=research.html` limits a patch to one page. The deployed pages remain static and do not fetch this data at runtime. Preserve `profile:*` comment markers: they keep personal details editable across publications.

Shared document styling is in `assets/css/refinements.css`; the final responsive presentation is in `assets/css/editorial.css`, loaded last. The desktop homepage places the biography beside a manually scrollable News region. Preserve publication and record markers when modifying templates. Existing honor totals include additional records from the original CV; do not recalculate them from named entries alone. Aggregate News and individual awards are distinct: only explicit source associations or unambiguous historical records are synchronized.

Keep English and Chinese records aligned. Distinguish submitted manuscripts from accepted or published articles, and include the year and subject category with journal quartiles. Preserve date precision: certificate dates, competition periods, and submission dates are distinct. Approximate months retain the quiet `≈` marker. Undergraduate follow-up work stays in the undergraduate stage even after master's enrollment.

The public identity is 许源知 / Yuanzhi Xu and is editable through the personal-details form. Existing GitHub and Gitee account handles are unchanged. The existing authorized CV PDF retains its original identity; certificate images, private contact details, and manuscript identifiers are not published as site assets.

## Preview

Run `python3 -m http.server 8765 --bind 127.0.0.1` from this directory and open http://127.0.0.1:8765/. Check the modified pages at desktop and mobile widths before pushing both remotes.
