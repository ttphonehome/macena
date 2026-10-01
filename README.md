# Jose Macena — portfolio

Static rebuild of the Figma Make prototype (`../oh-zeeeeee`). No build step.

- `index.html` — all content (projects live as `data-*` attributes on the hero `<img>`s)
- `styles.css` — tokens at the top, mobile overrides in the `max-width: 767px` block
- `main.js` — Lenis smooth scroll, GSAP ScrollTrigger hero, SplitText reveals, carousel
- `assets/vendor/` — GSAP 3.15.0 (+ ScrollTrigger, SplitText) and Lenis 1.3.26, self-hosted
- `assets/img/` — 900w / 1800w JPEGs served via `srcset`

## Run

```bash
cd "/Users/titi/Documents/Claude Sites/macena" && python3 -m http.server 5194 --bind 127.0.0.1
```

## Swapping in real content

- Projects: duplicate a `.hero__slide` `<img>` and edit `src`, `srcset`, `alt`, `data-client`, `data-blurb`. The counter updates automatically.
- Images: add `name-900.jpg` and `name-1800.jpg` to `assets/img/`.
- Social links in the footer are still `href="#"`.
