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

  // Very subtle scroll parallax: images drift ±3% inside the frame from the
  // top of the hero until it has scrolled away (uses the 6% CSS bleed)
  if (!reduceMotion) {
    gsap.fromTo(
      slides,
      { yPercent: -3 },
      {
        yPercent: 3,
        ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
      },
    )
  }

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
      scrollTrigger: { trigger: footer, start: "top 90%", once: true },
    })
    footerTl
      .fromTo(
        "[data-footer-letter]",
        { yPercent: 110, rotate: 6 },
        { yPercent: 0, rotate: 0, ease: "expo.out", duration: 1.3, stagger: 0.07 },
      )
  }

  /* ------------------------------------------------------------------------
     Intro: wordmark letters rise once fonts are ready
     ------------------------------------------------------------------------ */
  /* ------------------------------------------------------------------------
     Hero wordmark hover: "Mouse Grid" displacement (WebGL2)
     Ported from the 27b logo experiment. A coarse grid remembers the
     pointer's velocity and decays each frame; a shader reads the text
     stencil offset by each cell's value, so blocks of MACENA shear
     along the mouse path. The canvas only replaces the DOM text while
     the effect is alive, so the intro, scroll fade and a11y stay intact.
     ------------------------------------------------------------------------ */
  const WORDMARK_FX = {
    gridSize: 52, // cells across the viewport (as in the full-screen original)
    mouseRadius: 0.192,
    dissipation: 0.94,
    strength: 1.89,
  }

  function initWordmarkFx() {
    if (reduceMotion || !finePointer.matches) return
    const mark = $(".hero .wordmark")
    const wrap = mark?.parentElement
    if (!wrap) return

    const canvas = document.createElement("canvas")
    canvas.className = "wordmark-fx"
    canvas.setAttribute("aria-hidden", "true")
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: false })
    if (!gl) return
    wrap.appendChild(canvas)

    const VERT = `#version 300 es
    in vec2 aPos;
    out vec2 vUv;
    void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`

    const FRAG = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;
    uniform sampler2D uLogo;  // alpha = ink
    uniform sampler2D uGrid;  // rg = push (in viewport units)
    uniform float uStrength;
    uniform vec2 uScale;      // viewport px / canvas px: keeps offsets viewport-relative
    uniform vec3 uFg;
    float ink(vec2 uv) {
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
      return texture(uLogo, uv).a;
    }
    void main() {
      vec2 offset = texture(uGrid, vUv).rg * 0.02 * uStrength * uScale;
      outColor = vec4(uFg, ink(vUv - offset));
    }`

    const compile = (type, src) => {
      const sh = gl.createShader(type)
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh))
      return sh
    }
    const program = gl.createProgram()
    try {
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT))
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG))
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("link")
    } catch (_) {
      canvas.remove()
      return
    }
    gl.useProgram(program)

    const quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, "aPos")
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const u = {}
    for (const n of ["uLogo", "uGrid", "uStrength", "uScale", "uFg"]) u[n] = gl.getUniformLocation(program, n)
    gl.uniform1i(u.uLogo, 0)
    gl.uniform1i(u.uGrid, 1)
    gl.uniform1f(u.uStrength, WORDMARK_FX.strength)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const logoTex = gl.createTexture()
    const gridTex = gl.createTexture()
    const stencil = document.createElement("canvas")
    const sctx = stencil.getContext("2d")

    let cols = 0
    let rows = 0
    let cellW = 1
    let cellH = 1
    let grid = new Float32Array(0)
    let dpr = 1

    // Size the canvas over the wordmark (plus margin for displaced ink) and
    // redraw the stencil from the live DOM layout, so it matches exactly.
    function layout() {
      const fs = parseFloat(mark.style.fontSize) || parseFloat(getComputedStyle(mark).fontSize)
      const margin = Math.round(fs * 0.14)
      canvas.style.left = `${-margin}px`
      canvas.style.top = `${-margin}px`
      canvas.style.width = `calc(100% + ${margin * 2}px)`
      canvas.style.height = `calc(100% + ${margin * 2}px)`

      const box = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = stencil.width = Math.round(box.width * dpr)
      canvas.height = stencil.height = Math.round(box.height * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)

      // Text stencil: each glyph at its real position and baseline
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sctx.clearRect(0, 0, box.width, box.height)
      sctx.fillStyle = "#000"
      sctx.textBaseline = "alphabetic"
      const style = getComputedStyle(mark)
      sctx.font = `${style.fontWeight} ${fs}px ${style.fontFamily}`
      const baseline = $(".wordmark__probe", mark).getBoundingClientRect().top - box.top
      $$("[data-letter]", mark).forEach((glyph) => {
        const r = glyph.getBoundingClientRect()
        sctx.fillText(glyph.textContent.trim(), r.left - box.left, baseline)
      })

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, logoTex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, stencil)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      // Grid cells keep the original's on-screen size (viewport / gridSize)
      cellW = window.innerWidth / WORDMARK_FX.gridSize
      cellH = window.innerHeight / WORDMARK_FX.gridSize
      cols = Math.max(1, Math.ceil(box.width / cellW))
      rows = Math.max(1, Math.ceil(box.height / cellH))
      grid = new Float32Array(cols * rows * 4)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, gridTex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, cols, rows, 0, gl.RGBA, gl.FLOAT, grid)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      gl.uniform2f(u.uScale, window.innerWidth / box.width, window.innerHeight / box.height)
      const fg = getComputedStyle(mark).color.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => v / 255)
      gl.uniform3f(u.uFg, fg[0], fg[1], fg[2])
    }

    // Pointer state in canvas px (y measured from the bottom, like the shader)
    const mouse = { x: 0, y: 0, vx: 0, vy: 0, px: null, py: null }
    let hovering = false
    let active = false
    let raf = 0

    const onMove = (event) => {
      const box = canvas.getBoundingClientRect()
      const x = event.clientX - box.left
      const y = box.bottom - event.clientY
      if (mouse.px !== null) {
        // Velocity normalised to the viewport, as in the full-screen original
        mouse.vx = (x - mouse.px) / window.innerWidth
        mouse.vy = (y - mouse.py) / window.innerHeight
      }
      mouse.x = mouse.px = x
      mouse.y = mouse.py = y
    }

    function step() {
      const { mouseRadius, dissipation, gridSize } = WORDMARK_FX
      const maxDist = gridSize * mouseRadius
      const aspect = cellW / cellH
      const mx = mouse.x / cellW
      const my = mouse.y / cellH
      const moving = Math.min(1, Math.hypot(mouse.vx, mouse.vy) * 60)
      let energy = 0

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = 4 * (i + cols * j)
          grid[k] *= dissipation
          grid[k + 1] *= dissipation
          grid[k + 2] *= dissipation
          if (hovering) {
            const dx = (mx - i - 0.5) * aspect
            const dy = my - j - 0.5
            const d2 = dx * dx + dy * dy
            if (d2 < maxDist * maxDist) {
              const power = Math.min(maxDist / Math.sqrt(d2 || 1e-4), 10)
              grid[k] += mouse.vx * 100 * power
              grid[k + 1] += mouse.vy * 100 * power
              grid[k + 2] = Math.min(1, grid[k + 2] + moving * (1 - Math.sqrt(d2) / maxDist))
            }
          }
          energy = Math.max(energy, Math.abs(grid[k]), Math.abs(grid[k + 1]))
        }
      }
      mouse.vx *= 0.9
      mouse.vy *= 0.9

      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, gridTex)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RGBA, gl.FLOAT, grid)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      // Settled and pointer gone: hand back to the DOM text
      if (!hovering && energy < 0.002) return stop()
      raf = requestAnimationFrame(step)
    }

    function start() {
      if (active) return
      // Show the canvas first: it must have a size before layout() measures it
      wrap.classList.add("is-fx")
      layout()
      active = true
      raf = requestAnimationFrame(step)
    }
    function stop() {
      active = false
      cancelAnimationFrame(raf)
      wrap.classList.remove("is-fx")
      grid.fill(0)
    }

    // Wake on any mouse movement over the wordmark (not just on enter), so it
    // also works when the pointer was already resting there as the intro ended
    const engage = (event) => {
      if (!introDone || event.pointerType !== "mouse") return false
      // Only while the wordmark is actually on screen at the top
      if (heroTl.scrollTrigger.progress > 0.2) return false
      if (!hovering) {
        hovering = true
        mouse.px = mouse.py = null
        start()
      }
      return true
    }
    wrap.addEventListener("pointerenter", (event) => {
      if (engage(event)) onMove(event)
    })
    wrap.addEventListener("pointermove", (event) => {
      if (engage(event)) onMove(event)
    })
    wrap.addEventListener("pointerleave", () => {
      hovering = false
      mouse.px = mouse.py = null
    })
    window.addEventListener("resize", () => {
      if (active) stop()
    })
  }

  initWordmarkFx()

  const root = document.documentElement
  // Ready = the randomly chosen display font is actually loaded (3s cap)
  const fontsReady = document.fonts
    ? Promise.race([
        Promise.all([
          document.fonts.load(`${getComputedStyle(document.body).fontWeight} 100px ${getComputedStyle(document.body).fontFamily}`),
          document.fonts.ready,
        ]),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ])
    : Promise.resolve()

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
   * Landing intro (full version once per session)
   *  1. Overlay: "JOSE ▢ MACENA". Letters rise while a wide image box
   *     opens between the words and flicks through the projects; a
   *     counter tracks real font + image loading (1.8s min, 3.5s cap).
   *  2. Close-in: the image shrinks to an inline size, pulling the
   *     words together around it.
   *  3. Handoff: the words exit, the image flies into the hero preview
   *     box and the overlay dissolves while the hero plays its reveal.
   *  Repeat visits and deep links skip 1–3 and play the hero reveal only.
   */
  function playIntro() {
    const overlay = $("[data-intro]")
    const row = $("[data-intro-row]", overlay)
    const media = $("[data-intro-media]", overlay)
    const mediaImgs = $$("img", media)
    const introLetters = $$("[data-intro-letter]", overlay)
    const countWrap = $("[data-intro-count]", overlay)
    const countOut = $("[data-intro-count-out]", overlay)

    const letters = $$("[data-letter]", hero)
    const availability = $(".availability", hero)
    const navLinks = $$(".site-header__nav > a", header)

    const full = !root.classList.contains("is-repeat")

    if (full) {
      if ("scrollRestoration" in history) history.scrollRestoration = "manual"
      window.scrollTo(0, 0)
      lenis?.scrollTo(0, { immediate: true })
      lenis?.stop()
      root.style.overflow = "hidden"
      overlay.classList.add("is-active")
    }

    // Hero pre-states. y: 0 discards the px offset GSAP parses from the
    // CSS translateY(110%) pre-state, so yPercent alone drives the letters.
    gsap.set(letters, { y: 0, yPercent: 110, rotate: 6 })
    gsap.set(availability, { autoAlpha: 1, clipPath: "inset(0% 100% 0% 0%)" })
    gsap.set(navLinks, { autoAlpha: 0, yPercent: -120 })
    root.classList.remove("is-loading")

    const finish = () => {
      introDone = true
      root.style.overflow = ""
      lenis?.start()
      overlay.classList.remove("is-active")
      overlay.style.display = "none"
      try {
        sessionStorage.setItem("mc-intro", "1")
      } catch (_) {}
    }

    const heroReveal = (short) => {
      const s = short ? 0.75 : 1
      return gsap
        .timeline()
        .to(
          letters,
          { yPercent: 0, rotate: 0, duration: 1.4 * s, ease: "expo.out", stagger: 0.06 * s },
          0,
        )
        .to(
          availability,
          { clipPath: "inset(0% 0% 0% 0%)", duration: 0.9 * s, ease: "expo.inOut" },
          0.35 * s,
        )
        .to(navLinks, { autoAlpha: 1, yPercent: 0, duration: 0.8, ease: "expo.out", stagger: 0.07 }, 0.45 * s)
    }

    if (!full) {
      fontsReady.then(() => heroReveal(true).eventCallback("onComplete", finish))
      return
    }

    /* ---- 1. Opening ---- */
    gsap.set(frame, { opacity: 0 }) // the hero image waits for the handoff
    gsap.set(introLetters, { y: 0, yPercent: 110 })

    const spread = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const width = Math.min(vw * (vw < 768 ? 0.42 : 0.3), 34 * 16)
      return { width, height: Math.min(width * 0.66, vh * 0.42) }
    }
    gsap.set(media, { ...spread(), clipPath: "inset(50% 0% 50% 0%)" })

    // Flick through the projects inside the image box
    let flickIndex = 0
    const showMedia = (i) =>
      mediaImgs.forEach((img, j) => {
        img.style.zIndex = j === i ? 1 : 0
      })
    showMedia(0)
    const flick = gsap.to(
      {},
      {
        duration: 0.12,
        repeat: -1,
        onRepeat: () => {
          flickIndex = (flickIndex + 1) % mediaImgs.length
          showMedia(flickIndex)
        },
      },
    )

    gsap
      .timeline()
      .to(introLetters, { yPercent: 0, duration: 1.2, ease: "expo.out", stagger: 0.035 }, 0.1)
      .to(media, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "expo.inOut" }, 0.25)
      .fromTo(
        countWrap.children,
        { yPercent: 110 },
        { yPercent: 0, duration: 0.6, ease: "expo.out", stagger: 0.05 },
        0.3,
      )

    // Counter follows real loading: fonts + every image, capped
    const counter = { value: 0 }
    const render = () => {
      countOut.textContent = String(Math.round(counter.value)).padStart(3, "0")
    }
    let counterTween = gsap.to(counter, { value: 90, duration: 1.6, ease: "power2.out", onUpdate: render })

    const loads = [
      fontsReady,
      ...[...slides, ...mediaImgs].map((img) =>
        img.complete ? Promise.resolve() : img.decode().catch(() => {}),
      ),
    ]
    const assets = Promise.race([
      Promise.all(loads),
      new Promise((resolve) => setTimeout(resolve, 3500)),
    ])
    const minimum = new Promise((resolve) => setTimeout(resolve, 1800))

    Promise.all([assets, minimum]).then(() => {
      counterTween.kill()
      counterTween = gsap.to(counter, {
        value: 100,
        duration: 0.4,
        ease: "power2.inOut",
        onUpdate: render,
        onComplete: closeIn,
      })
    })

    /* ---- 2. Close-in: image shrinks inline, words slide together ---- */
    function closeIn() {
      fitAll()
      const fs0 = parseFloat(getComputedStyle(row).fontSize)
      // Size the closed-in row to fit the screen whatever the typeface: wide
      // faces (Unbounded, Ultra) shrink slightly, narrow ones keep full size.
      // Row width = words + inline image (1.2em) + its margins (0.16em).
      const wordsW = $$(".intro__word", overlay).reduce((sum, w) => sum + w.getBoundingClientRect().width, 0)
      const fs = Math.min(fs0, (window.innerWidth * 0.94) / (wordsW / fs0 + 1.36))
      gsap
        .timeline()
        .to(countWrap.children, { yPercent: -110, duration: 0.5, ease: "power3.in", stagger: 0.04 }, 0)
        .to(row, { fontSize: fs, duration: 1.2, ease: "expo.inOut" }, 0.1)
        .to(media, { width: fs * 1.2, height: fs * 0.72, duration: 1.2, ease: "expo.inOut" }, 0.1)
        .call(
          () => {
            // Land on the first project in both the overlay and the hero
            flick.kill()
            showMedia(0)
            index = 0
            restack(0)
            writeCopy(0)
          },
          null,
          0.9,
        )
        .add(handoff, 1.65)
    }

    /* ---- 3. Handoff: image flies into the hero preview box ---- */
    function handoff() {
      const from = media.getBoundingClientRect()
      const to = target.getBoundingClientRect()

      // Hold the row's layout while the image leaves it
      const spacer = document.createElement("div")
      const ms = getComputedStyle(media)
      spacer.style.cssText = `flex:none;width:${from.width}px;height:${from.height}px;margin:0 ${ms.marginRight} 0 ${ms.marginLeft}`
      media.before(spacer)
      overlay.appendChild(media)
      gsap.set(media, {
        position: "fixed",
        left: from.left,
        top: from.top,
        width: from.width,
        height: from.height,
        margin: 0,
        zIndex: 2,
      })

      gsap
        .timeline({ onComplete: finish })
        .to(introLetters, { yPercent: -110, duration: 0.7, ease: "expo.in", stagger: 0.025 }, 0)
        .to(
          media,
          { left: to.left, top: to.top, width: to.width, height: to.height, duration: 1.25, ease: "expo.inOut" },
          0.15,
        )
        .to(overlay, { backgroundColor: "rgba(255,255,255,0)", duration: 0.8, ease: "power2.inOut" }, 0.6)
        .add(heroReveal(false), 0.65)
        // Cross-fade to the real hero image once the box has landed
        .set(frame, { opacity: 1 }, 1.35)
        .to(media, { autoAlpha: 0, duration: 0.35, ease: "power1.out" }, 1.36)
    }
  }
})()
