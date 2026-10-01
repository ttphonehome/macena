/* ==========================================================================
   Jose Macena — interactions
   GSAP 3.15 (ScrollTrigger, SplitText) + Lenis 1.3
   ========================================================================== */
;(() => {
  const { gsap, ScrollTrigger, SplitText, Lenis } = window
  if (!gsap || !ScrollTrigger) {
    document.documentElement.classList.remove("js")
    return
  }
  gsap.registerPlugin(ScrollTrigger, SplitText)

  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")

  // Mobile URL-bar show/hide shouldn't trigger a full ScrollTrigger refresh
  ScrollTrigger.config({ ignoreMobileResize: true })

  /* ------------------------------------------------------------------------
     Smooth scroll (Lenis) — wheel/trackpad only; touch keeps native momentum
     ------------------------------------------------------------------------ */
  let lenis = null
  if (!reduceMotion && Lenis) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, syncTouch: false })
    lenis.on("scroll", ScrollTrigger.update)
    gsap.ticker.add((time) => lenis.raf(time * 1000))
    gsap.ticker.lagSmoothing(0)
  }

  const currentScroll = () => (lenis ? lenis.scroll : window.scrollY)

  const scrollToY = (y) => {
    if (lenis) {
      lenis.scrollTo(y, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) })
    } else {
      window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" })
    }
  }

  /* ------------------------------------------------------------------------
     Wordmark: fit the inked glyphs of "MACENA" to the container width
     ------------------------------------------------------------------------ */
  const measureCtx = document.createElement("canvas").getContext("2d")

  function fitWordmark(el) {
    const parent = el.parentElement
    const width = parent.clientWidth
    if (!width || !measureCtx) return
    const style = getComputedStyle(el)
    measureCtx.font = `${style.fontWeight} 100px ${style.fontFamily}`
    const spacing = (parseFloat(style.letterSpacing) / parseFloat(style.fontSize)) * 100 || 0
    if ("letterSpacing" in measureCtx) measureCtx.letterSpacing = `${spacing}px`
    const m = measureCtx.measureText(el.dataset.fit)
    const left = -m.actualBoundingBoxLeft
    const ink = m.actualBoundingBoxRight - left
    if (!ink) return
    const size = (100 * width) / ink
    el.style.fontSize = `${size}px`
    el.style.marginLeft = `${(-left * size) / 100}px`
    placeName(el, style, size)
  }

  /**
   * Centre "JOSE" on the C's inked glyph (not its line box, which the
   * 0.74 line-height pushes off-centre). Uses offsetTop/Left so it is
   * unaffected by the letters' entrance transforms.
   */
  function placeName(el, style, size) {
    const name = $(".wordmark__name", el)
    const probe = $(".wordmark__probe", el)
    if (!name || !probe) return
    const glyph = probe.parentElement // inner span holding "C"
    const font = `${style.fontWeight} 100px ${style.fontFamily}`
    measureCtx.font = font
    if ("letterSpacing" in measureCtx) measureCtx.letterSpacing = "0px"
    const k = size / 100

    // C ink box relative to its glyph origin / baseline
    const c = measureCtx.measureText("C")
    const cLeft = -c.actualBoundingBoxLeft * k
    const cRight = c.actualBoundingBoxRight * k
    const cTop = -c.actualBoundingBoxAscent * k
    const cBottom = c.actualBoundingBoxDescent * k

    // Glyph origin and baseline inside the wordmark (offsetParent)
    const originX = offsetWithin(glyph, el).left
    const baseline = offsetWithin(probe, el).top
    const rightX = originX + cRight // where the C's terminals end
    const centerY = baseline + (cTop + cBottom) / 2

    // JOSE's own ink box (with its letter-spacing) inside its line box
    const nameStyle = getComputedStyle(name)
    const n = parseFloat(nameStyle.fontSize)
    measureCtx.font = `${nameStyle.fontWeight} 100px ${nameStyle.fontFamily}`
    if ("letterSpacing" in measureCtx) {
      const ls = (parseFloat(nameStyle.letterSpacing) / n) * 100 || 0
      measureCtx.letterSpacing = `${ls}px`
    }
    const j = measureCtx.measureText(name.textContent.trim())
    const kn = n / 100
    const ascent = (j.fontBoundingBoxAscent ?? j.actualBoundingBoxAscent) * kn
    const descent = (j.fontBoundingBoxDescent ?? j.actualBoundingBoxDescent) * kn
    const lineHeight = parseFloat(nameStyle.lineHeight) || n
    const nameBaseline = (lineHeight - (ascent + descent)) / 2 + ascent
    const nameInkMid =
      nameBaseline - ((j.actualBoundingBoxAscent - j.actualBoundingBoxDescent) * kn) / 2

    // Right-align JOSE's inked E to the C's right edge (ignore side bearing)
    const nameInkRight = j.actualBoundingBoxRight * kn
    name.style.left = `${rightX - nameInkRight}px`
    name.style.top = `${centerY - nameInkMid}px`
    name.style.right = "auto"
    gsap.set(name, { xPercent: 0, transformOrigin: "100% 50%" })
  }

  // Offset of `node` relative to `ancestor`, ignoring CSS transforms
  function offsetWithin(node, ancestor) {
    let left = 0
    let top = 0
    let current = node
    while (current && current !== ancestor) {
      left += current.offsetLeft
      top += current.offsetTop
      current = current.offsetParent
    }
    return { left, top }
  }

  const wordmarks = $$("[data-fit]")
  const fitAll = () => wordmarks.forEach(fitWordmark)
  fitAll()

  let lastWidth = window.innerWidth
  let lastHeight = window.innerHeight
  let resizeTimer = 0
  window.addEventListener("resize", () => {
    const widthChanged = window.innerWidth !== lastWidth
    // On touch devices a height-only resize is the URL bar showing/hiding:
    // ignore it so nothing jumps. On desktop, height changes move triggers.
    const heightMatters = !ScrollTrigger.isTouch && window.innerHeight !== lastHeight
    if (!widthChanged && !heightMatters) return
    lastWidth = window.innerWidth
    lastHeight = window.innerHeight
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (widthChanged) fitAll()
      ScrollTrigger.refresh()
    }, 150)
  })

  /* ------------------------------------------------------------------------
     Header: hide on scroll down, reveal on scroll up
     ------------------------------------------------------------------------ */
  const header = $("[data-header]")
  let lastY = currentScroll()
  const onScrollHeader = () => {
    const y = currentScroll()
    if (Math.abs(y - lastY) < 6) return
    header.classList.toggle("is-hidden", y > lastY && y > 80)
    lastY = y
  }
  if (lenis) lenis.on("scroll", onScrollHeader)
  else window.addEventListener("scroll", onScrollHeader, { passive: true })
  header.addEventListener("focusin", () => header.classList.remove("is-hidden"))

  /* ------------------------------------------------------------------------
     Hero: small preview → full-bleed project viewer
     The frame is always full size. We clip it down to the target box and
     scale the image layer so it fills that box; both tween back to identity
     with the same ease, so the image always covers the visible window.
     ------------------------------------------------------------------------ */
  const hero = $("[data-hero]")
  const frame = $("[data-hero-frame]")
  const slidesLayer = $("[data-hero-slides]")
  const target = $("[data-hero-target]")
  const intro = $("[data-hero-intro]")
  const ui = $("[data-project-ui]")
  const slides = $$(".hero__slide", slidesLayer)
  const EXPAND = 0.75 // share of the hero scroll used for the expansion

  let startState = null
  const getStart = () => {
    if (startState) return startState
    const f = frame.getBoundingClientRect()
    const t = target.getBoundingClientRect()
    startState = {
      clip: `inset(${t.top - f.top}px ${f.right - t.right}px ${f.bottom - t.bottom}px ${t.left - f.left}px)`,
      scale: Math.max(t.width / f.width, t.height / f.height),
      x: t.left + t.width / 2 - (f.left + f.width / 2),
      y: t.top + t.height / 2 - (f.top + f.height / 2),
    }
    return startState
  }
  ScrollTrigger.addEventListener("refreshInit", () => {
    startState = null
  })

  let expanded = false
  const setExpanded = (value) => {
    if (value === expanded) return
    expanded = value
    hero.classList.toggle("is-expanded", value)
    ui.inert = !value
  }
  ui.inert = true

  const heroTl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: hero,
      start: "top top",
      end: "bottom bottom",
      scrub: reduceMotion ? true : 0.6,
      invalidateOnRefresh: true,
      onUpdate: (self) => setExpanded(self.progress >= EXPAND - 0.02),
    },
  })

  heroTl
    .fromTo(
      frame,
      { clipPath: () => getStart().clip },
      { clipPath: "inset(0px 0px 0px 0px)", ease: "power2.inOut", duration: EXPAND },
      0,
    )
    .fromTo(
      slidesLayer,
      { x: () => getStart().x, y: () => getStart().y, scale: () => getStart().scale },
      { x: 0, y: 0, scale: 1, ease: "power2.inOut", duration: EXPAND },
      0,
    )
    .to(intro, { autoAlpha: 0, y: -60, ease: "power2.in", duration: EXPAND * 0.4 }, 0)
    .fromTo(ui, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, EXPAND - 0.1)
    .to({}, { duration: 1 - EXPAND }) // hold full-bleed

  gsap.set(frame, { visibility: "visible" })

  /* ---------- Project carousel ---------- */
  const clientOut = $("[data-client-out]")
  const blurbOut = $("[data-blurb-out]")
  const countOut = $("[data-count]")
  const total = slides.length
  let index = 0
  let swapTl = null
  let copySplit = null

  const splitCopy = () => {
    copySplit?.revert()
    copySplit = SplitText.create([clientOut, blurbOut], {
      type: "lines",
      mask: "lines",
      linesClass: "line",
    })
    return copySplit
  }

  const writeCopy = (i) => {
    copySplit?.revert()
    copySplit = null
    clientOut.textContent = slides[i].dataset.client
    blurbOut.textContent = slides[i].dataset.blurb
    countOut.textContent = `${i + 1}/${total}`
  }

  const restack = (active) => {
    slides.forEach((slide, i) => {
      gsap.set(slide, {
        zIndex: i === active ? 1 : 0,
        clipPath: "none",
        scale: 1,
        xPercent: 0,
        autoAlpha: 1,
      })
    })
  }

  function go(direction) {
    swapTl?.progress(1).kill()
    const prev = index
    const next = (index + direction + total) % total
    index = next
    const incoming = slides[next]
    const outgoing = slides[prev]

    swapTl = gsap.timeline({ onComplete: () => restack(next) })

    if (reduceMotion) {
      swapTl
        .fromTo(incoming, { zIndex: 2, autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 })
        .call(() => writeCopy(next), null, 0)
      return
    }

    swapTl
      .fromTo(
        incoming,
        {
          zIndex: 2,
          clipPath: direction === 1 ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)",
          scale: 1.12,
        },
        { clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 1, ease: "expo.inOut" },
        0,
      )
      .to(outgoing, { xPercent: -8 * direction, duration: 1, ease: "expo.inOut" }, 0)

    // Copy: lines slide out, text swaps, new lines rise in
    const lines = (copySplit || splitCopy()).lines
    swapTl
      .to(lines, { yPercent: -105, duration: 0.35, ease: "power2.in", stagger: 0.03 }, 0)
      .call(() => writeCopy(next), null, 0.4)
      .add(() => {
        const fresh = splitCopy().lines
        gsap.fromTo(
          fresh,
          { yPercent: 105 },
          { yPercent: 0, duration: 0.8, ease: "expo.out", stagger: 0.06 },
        )
      }, 0.4)
  }

  $$("[data-prev]", ui).forEach((btn) => btn.addEventListener("click", () => go(-1)))
  $$("[data-next]", ui).forEach((btn) => btn.addEventListener("click", () => go(1)))

  // Keyboard: arrows when the viewer is on screen
  window.addEventListener("keydown", (event) => {
    if (!expanded || !heroTl.scrollTrigger.isActive) return
    if (event.key === "ArrowRight") go(1)
    if (event.key === "ArrowLeft") go(-1)
  })

  // Touch swipe (horizontal only; vertical pans scroll the page)
  let swipe = null
  ui.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return
    swipe = { x: event.clientX, y: event.clientY }
  })
  ui.addEventListener("pointerup", (event) => {
    if (!swipe) return
    const dx = event.clientX - swipe.x
    const dy = event.clientY - swipe.y
    swipe = null
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1)
  })
  ui.addEventListener("pointercancel", () => {
    swipe = null
  })

  // While the preview is still small, flick through projects
  let introDone = reduceMotion
  if (!reduceMotion) {
    setInterval(() => {
      if (!introDone || document.hidden || heroTl.scrollTrigger.progress > 0.01) return
      index = (index + 1) % total
      restack(index)
      writeCopy(index)
    }, 600)
  }

  /* ---------- Chevron cursor (fine pointers) ---------- */
  const cursor = $("[data-cursor]")
  if (finePointer.matches && !reduceMotion) {
    gsap.set(cursor, { xPercent: -50, yPercent: -50, scale: 0, autoAlpha: 0, rotation: 90 })
    const xTo = gsap.quickTo(cursor, "x", { duration: 0.45, ease: "power3.out" })
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.45, ease: "power3.out" })
    let side = 1

    const local = (event) => {
      const rect = ui.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top, w: rect.width }
    }

    ui.addEventListener("pointermove", (event) => {
      const p = local(event)
      xTo(p.x)
      yTo(p.y)
      const nextSide = p.x > p.w / 2 ? 1 : -1
      if (nextSide !== side) {
        side = nextSide
        gsap.to(cursor, { rotation: side * 90, duration: 0.5, ease: "back.out(2)" })
      }
    })
    ui.addEventListener("pointerenter", (event) => {
      const p = local(event)
      side = p.x > p.w / 2 ? 1 : -1
      gsap.set(cursor, { x: p.x, y: p.y, rotation: side * 90 })
      gsap.to(cursor, { scale: 1, autoAlpha: 1, duration: 0.4, ease: "back.out(1.8)" })
    })
    ui.addEventListener("pointerleave", () => {
      gsap.to(cursor, { scale: 0, autoAlpha: 0, duration: 0.3, ease: "power2.in" })
    })
    ui.addEventListener("pointerdown", () => {
      gsap.fromTo(
        cursor,
        { scale: 0.75 },
        { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.5)", overwrite: "auto" },
      )
    })
  }

  /* ------------------------------------------------------------------------
     Anchor navigation
     ------------------------------------------------------------------------ */
  $$("[data-scroll-to]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.dataset.scrollTo
      const el = document.getElementById(id)
      if (!el) return
      event.preventDefault()
      let y
      if (id === "work") {
        // Land where the viewer has just finished expanding
        const st = heroTl.scrollTrigger
        y = st.start + (st.end - st.start) * EXPAND
      } else {
        y = el.getBoundingClientRect().top + currentScroll()
      }
      scrollToY(y)
      history.replaceState(null, "", `#${id}`)
    })
  })

  /* ------------------------------------------------------------------------
     About
     ------------------------------------------------------------------------ */
  const about = $("[data-about]")
  const portrait = $("[data-portrait]")
  const mm = gsap.matchMedia()

  // Desktop: portrait follows the cursor
  mm.add("(hover: hover) and (pointer: fine) and (min-width: 768px)", () => {
    gsap.set(portrait, { xPercent: -50, yPercent: -50, autoAlpha: 0, scale: 0.85 })
    const xTo = gsap.quickTo(portrait, "x", { duration: 0.6, ease: "power3.out" })
    const yTo = gsap.quickTo(portrait, "y", { duration: 0.6, ease: "power3.out" })
    const rTo = gsap.quickTo(portrait, "rotation", { duration: 0.8, ease: "power3.out" })
    let lastX = 0

    const pos = (event) => {
      const rect = about.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }
    const move = (event) => {
      const p = pos(event)
      xTo(p.x)
      yTo(p.y)
      rTo(gsap.utils.clamp(-8, 8, (p.x - lastX) * 0.4))
      lastX = p.x
    }
    const enter = (event) => {
      const p = pos(event)
      lastX = p.x
      gsap.set(portrait, { x: p.x, y: p.y })
      gsap.to(portrait, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "power3.out" })
    }
    const leave = () => {
      gsap.to(portrait, { autoAlpha: 0, scale: 0.85, duration: 0.35, ease: "power2.in" })
    }

    about.addEventListener("pointermove", move)
    about.addEventListener("pointerenter", enter)
    about.addEventListener("pointerleave", leave)
    return () => {
      about.removeEventListener("pointermove", move)
      about.removeEventListener("pointerenter", enter)
      about.removeEventListener("pointerleave", leave)
    }
  })

  // Touch / small screens: portrait unmasks and settles as it scrolls in
  mm.add(
    "not ((hover: hover) and (pointer: fine) and (min-width: 768px)) and (prefers-reduced-motion: no-preference)",
    () => {
      const img = $("img", portrait)
      gsap.fromTo(
        portrait,
        { clipPath: "inset(100% 0% 0% 0%)" },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          ease: "expo.out",
          duration: 1.4,
          scrollTrigger: { trigger: portrait, start: "top 85%" },
        },
      )
      gsap.fromTo(
        img,
        { scale: 1.25, yPercent: -6 },
        {
          scale: 1,
          yPercent: 6,
          ease: "none",
          scrollTrigger: { trigger: portrait, start: "top bottom", end: "bottom top", scrub: true },
        },
      )
    },
  )

  // Copy: lines rise in on scroll (all devices)
  if (!reduceMotion) {
    SplitText.create("[data-split-lines]", {
      type: "lines",
      mask: "lines",
      linesClass: "line",
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 105,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.08,
          scrollTrigger: { trigger: self.elements[0], start: "top 82%" },
        }),
    })

    gsap.from(".about__label", {
      autoAlpha: 0,
      y: 20,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: { trigger: ".about__label", start: "top 85%" },
    })
  }

  /* ------------------------------------------------------------------------
     Experience: rules draw in, rows rise
     ------------------------------------------------------------------------ */
  if (!reduceMotion) {
    ScrollTrigger.batch(".experience__row", {
      start: "top 92%",
      once: true,
      onEnter: (rows) => {
        gsap.fromTo(
          rows,
          { borderTopColor: "rgba(0,0,0,0)" },
          { borderTopColor: "rgba(0,0,0,1)", duration: 0.6, stagger: 0.08, ease: "none" },
        )
        const cells = rows.flatMap((row) => [...row.children])
        // Fade each cell to its CSS opacity (dates are 40% on mobile only),
        // then hand opacity back to the stylesheet for breakpoint changes
        const targets = cells.map((el) => parseFloat(getComputedStyle(el).opacity) || 1)
        gsap.fromTo(
          cells,
          { autoAlpha: 0, yPercent: 60 },
          {
            autoAlpha: (i) => targets[i],
            yPercent: 0,
            duration: 0.9,
            ease: "expo.out",
            stagger: 0.025,
            clearProps: "opacity,visibility,transform",
          },
        )
      },
    })
  }

  /* ------------------------------------------------------------------------
     Footer wordmark
     ------------------------------------------------------------------------ */
  if (!reduceMotion) {
    const footer = $("[data-footer]")
    const footerTl = gsap.timeline({
      paused: true,
      scrollTrigger: { trigger: footer, start: "top 75%", once: true },
    })
    footerTl
      .fromTo(
        "[data-footer-letter]",
        { yPercent: 110, rotate: 6 },
        { yPercent: 0, rotate: 0, ease: "expo.out", duration: 1.3, stagger: 0.07 },
      )
      .fromTo(
        "[data-footer-name]",
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" },
        0.6,
      )
  }

  /* ------------------------------------------------------------------------
     Intro: wordmark letters rise once fonts are ready
     ------------------------------------------------------------------------ */
  const root = document.documentElement
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve()

  // Settle the wordmark once the real font is in, whatever happens next
  fontsReady.then(() => {
    fitAll()
    ScrollTrigger.refresh()
  })

  if (reduceMotion || !root.classList.contains("is-loading")) {
    root.classList.remove("is-loading")
  } else {
    playIntro()
  }

  /**
   * Landing intro
   *  A. Loading: the preview box is closed to a thin slit by two white
   *     panels; the projects flick behind it while a counter tracks
   *     real font + image loading (with a minimum duration).
   *  B. Reveal: counter exits, the slit opens to the full preview,
   *     MACENA rises letter by letter, JOSE pops into the C, the
   *     availability line wipes in and the nav drops down.
   *  Repeat visits in the same session skip A and play a shorter B.
   */
  function playIntro() {
    const curtain = $("[data-curtain]")
    const panels = $$(".hero__curtain-panel", curtain)
    const count = $(".hero__count", curtain)
    const countOut = $("[data-count-out]", curtain)
    const letters = $$("[data-letter]", hero)
    const name = $(".wordmark__name", hero)
    const availability = $(".availability", hero)
    const navLinks = $$(".site-header__nav > a", header)

    let seen = false
    try {
      seen = sessionStorage.getItem("mc-intro") === "1"
    } catch (_) {}

    // Start at the top with scrolling locked (unless arriving on a #section)
    const deepLink = Boolean(location.hash)
    if (!deepLink) {
      if ("scrollRestoration" in history) history.scrollRestoration = "manual"
      window.scrollTo(0, 0)
      lenis?.scrollTo(0, { immediate: true })
      lenis?.stop()
      root.style.overflow = "hidden"
    }

    // Take over the CSS pre-states with inline GSAP state
    gsap.set(panels, { scaleY: 1 })
    // y: 0 discards the px offset GSAP parses from the CSS pre-state
    gsap.set(letters, { y: 0, yPercent: 110, rotate: 6 })
    gsap.set(name, { autoAlpha: 0, scale: 0.4 })
    gsap.set(availability, { autoAlpha: 1, clipPath: "inset(0% 100% 0% 0%)" })
    gsap.set(navLinks, { autoAlpha: 0, yPercent: -120 })
    root.classList.remove("is-loading")

    // Fast flicker through the projects behind the slit
    let flick = null
    const startFlicker = () => {
      const step = () => {
        index = (index + 1) % total
        restack(index)
        flick = gsap.delayedCall(0.11, step)
      }
      flick = gsap.delayedCall(0.11, step)
    }
    const stopFlicker = () => {
      flick?.kill()
      index = 0
      restack(0)
      writeCopy(0)
    }

    const finish = () => {
      introDone = true
      root.style.overflow = ""
      lenis?.start()
      gsap.set(curtain, { display: "none" })
      try {
        sessionStorage.setItem("mc-intro", "1")
      } catch (_) {}
    }

    const reveal = (short) => {
      const tl = gsap.timeline({ onComplete: finish })
      const s = short ? 0.75 : 1 // compress timings on repeat visits

      if (!short) {
        tl.to(countOut, { yPercent: -110, duration: 0.5, ease: "power3.in" }, 0)
        tl.call(stopFlicker, null, 0.25)
      }

      tl.to(
        panels,
        { scaleY: 0, duration: 1.2 * s, ease: "expo.inOut" },
        short ? 0 : 0.2,
      )
        .to(
          letters,
          {
            yPercent: 0,
            rotate: 0,
            duration: 1.4 * s,
            ease: "expo.out",
            stagger: 0.06 * s,
          },
          short ? 0.15 : 0.55,
        )
        .to(
          availability,
          { clipPath: "inset(0% 0% 0% 0%)", duration: 0.9 * s, ease: "expo.inOut" },
          short ? 0.5 : 1.0,
        )
        .to(
          name,
          { autoAlpha: 1, scale: 1, duration: 0.7, ease: "back.out(2.2)" },
          short ? 0.7 : 1.25,
        )
        .to(
          navLinks,
          { autoAlpha: 1, yPercent: 0, duration: 0.8, ease: "expo.out", stagger: 0.07 },
          short ? 0.6 : 1.1,
        )
      return tl
    }

    if (seen || deepLink) {
      fontsReady.then(() => reveal(true))
      return
    }

    // Phase A — loading
    gsap.set(count, { visibility: "visible" })
    gsap.fromTo(countOut, { yPercent: 110 }, { yPercent: 0, duration: 0.6, ease: "expo.out" })
    gsap.to(panels, { scaleY: 0.955, duration: 0.9, ease: "expo.inOut", delay: 0.15 })
    startFlicker()

    const counter = { value: 0 }
    const render = () => {
      countOut.textContent = String(Math.round(counter.value)).padStart(3, "0")
    }
    let counterTween = gsap.to(counter, {
      value: 90,
      duration: 1.4,
      ease: "power2.out",
      onUpdate: render,
    })

    // Real loading signal: fonts + every hero image, capped so we never hang
    const loads = [
      fontsReady,
      ...slides.map((img) =>
        img.complete ? Promise.resolve() : img.decode().catch(() => {}),
      ),
    ]
    const assets = Promise.race([
      Promise.all(loads),
      new Promise((resolve) => setTimeout(resolve, 3500)),
    ])
    const minimum = new Promise((resolve) => setTimeout(resolve, 1500))

    Promise.all([assets, minimum]).then(() => {
      counterTween.kill()
      counterTween = gsap.to(counter, {
        value: 100,
        duration: 0.45,
        ease: "power2.inOut",
        onUpdate: render,
        onComplete: () => {
          fitAll()
          reveal(false)
        },
      })
    })
  }
})()
