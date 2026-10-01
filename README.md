# YJ-MoLi · Academic Website

Personal academic website covering research, engineering projects, education, and competition experience.

- Website: https://blog.dengshu.cloud/
- English is the default language; Chinese pages are under `/zh/`.
- GitHub is the source repository; Gitee is its synchronized mirror.
- Hosting is GitHub Pages, with Cloudflare in front of the custom domain.

## Pages

Home, News, Research, Projects, Awards, and CV have English and Chinese versions. Detailed undergraduate and graduate records are linked from CV. The homepage news section uses a fixed-height, manually scrollable region.

## Editing

This is a static HTML/CSS site with no build step. Shared navigation and document styling is in `assets/css/site-shell.css`; homepage and inner-page layouts use their existing CSS files. Keep navigation and language counterparts consistent when adding a page.

News records for both languages live in `assets/data/news.json`. After editing records, `node scripts/render-news.mjs` emits an apply_patch patch for the two homepages and two timeline pages. Apply that patch, then run `node scripts/render-news.mjs --check` to verify synchronization. The deployed pages remain static and do not fetch this data at runtime.

Keep English and Chinese records aligned. Distinguish submitted manuscripts from accepted or published articles, and include the year and subject category with journal quartiles. Preserve date precision: certificate dates, competition periods, and submission dates are distinct. Approximate months must retain the visible `≈` marker and explanation.

The public identity is YJ-MoLi. The existing authorized CV PDF is the exception; certificate images, private contact details, and manuscript identifiers are not published as site assets.

## Preview

Run `python3 -m http.server 8765 --bind 127.0.0.1` from this directory and open http://127.0.0.1:8765/. Check the modified pages at desktop and mobile widths before pushing both remotes.
