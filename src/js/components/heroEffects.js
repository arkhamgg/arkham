// ========================================
// ARKHAM — Hero Effects Component
// ========================================

export function HeroEffects() {
  const effects = document.createElement("div");

  effects.className = "hero-effects";
  effects.setAttribute("aria-hidden", "true");

  effects.innerHTML = `

    <!-- ========================================
         DESKTOP
         ======================================== -->

    <svg
      class="hero-effects__svg hero-effects__svg--desktop"
      viewBox="0 0 1920 900"
      preserveAspectRatio="xMidYMid slice"
    >

      <!-- Fragmentos -->

      <g
        class="hero-effects__fragment hero-effects__fragment--01"
        transform="translate(1080 170)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,0 90,25 70,110 20,80" />
        </g>
      </g>

      <g
        class="hero-effects__fragment hero-effects__fragment--02"
        transform="translate(1450 110)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,20 65,0 110,55 40,90" />
        </g>
      </g>

      <g
        class="hero-effects__fragment hero-effects__fragment--03"
        transform="translate(900 470)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,0 55,15 35,75 10,50" />
        </g>
      </g>

      <g
        class="hero-effects__fragment hero-effects__fragment--04"
        transform="translate(1580 500)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,30 75,0 105,45 60,100" />
        </g>
      </g>

      <g
        class="hero-effects__fragment hero-effects__fragment--05"
        transform="translate(1220 600)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,10 45,0 80,35 35,70" />
        </g>
      </g>

      <g
        class="hero-effects__fragment hero-effects__fragment--06"
        transform="translate(760 250)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,0 45,12 30,55 8,40" />
        </g>
      </g>

      <g
        class="hero-effects__fragment hero-effects__fragment--07"
        transform="translate(1680 280)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,15 35,0 55,30 25,60" />
        </g>
      </g>

      <g
        class="hero-effects__fragment hero-effects__fragment--08"
        transform="translate(1370 720)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,0 30,10 20,45 5,30" />
        </g>
      </g>


      <!-- Energía -->

      <g class="hero-effects__energy">

        <path
          class="hero-effects__energy-line"
          d="M760 720 L1180 210"
        />

        <path
          class="hero-effects__energy-line"
          d="M1040 820 L1530 250"
        />

        <path
          class="hero-effects__energy-line"
          d="M1280 700 L1710 180"
        />

      </g>


      <!-- Partículas -->

      <g class="hero-effects__particles">

        <circle cx="720" cy="170" r="3" />
        <circle cx="840" cy="310" r="2" />
        <circle cx="1010" cy="140" r="3" />
        <circle cx="1160" cy="290" r="2" />
        <circle cx="1320" cy="120" r="3" />
        <circle cx="1450" cy="350" r="2" />
        <circle cx="1580" cy="190" r="3" />
        <circle cx="1730" cy="430" r="2" />
        <circle cx="900" cy="650" r="2" />
        <circle cx="1500" cy="690" r="3" />

      </g>

    </svg>


    <!-- ========================================
         TABLET
         ======================================== -->

    <svg
      class="hero-effects__svg hero-effects__svg--tablet"
      viewBox="0 0 1024 800"
      preserveAspectRatio="xMidYMid slice"
    >

      <!-- Fragmentos -->

      <g
        class="hero-effects__fragment hero-effects__fragment--tablet-01"
        transform="translate(600 120)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,0 65,18 50,78 15,55" />
        </g>
      </g>

      <g
        class="hero-effects__fragment hero-effects__fragment--tablet-02"
        transform="translate(830 170)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,15 48,0 75,38 30,62" />
        </g>
      </g>

      <g
        class="hero-effects__fragment hero-effects__fragment--tablet-03"
        transform="translate(520 500)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,0 42,12 28,58 8,42" />
        </g>
      </g>

      <g
        class="hero-effects__fragment hero-effects__fragment--tablet-04"
        transform="translate(860 570)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,12 42,0 62,30 25,55" />
        </g>
      </g>


      <!-- Energía -->

      <g class="hero-effects__energy">

        <path
          class="hero-effects__energy-line"
          d="M470 700 L760 230"
        />

        <path
          class="hero-effects__energy-line"
          d="M650 760 L920 300"
        />

      </g>


      <!-- Partículas -->

      <g class="hero-effects__particles">

        <circle cx="510" cy="130" r="3" />
        <circle cx="690" cy="210" r="2" />
        <circle cx="820" cy="110" r="3" />
        <circle cx="900" cy="360" r="2" />
        <circle cx="570" cy="580" r="2" />
        <circle cx="780" cy="650" r="3" />

      </g>

    </svg>


    <!-- ========================================
         MOBILE
         ======================================== -->

    <svg
      class="hero-effects__svg hero-effects__svg--mobile"
      viewBox="0 0 390 700"
      preserveAspectRatio="xMidYMid slice"
    >

      <!-- Fragmentos -->

      <g
        class="hero-effects__fragment hero-effects__fragment--mobile-01"
        transform="translate(285 185)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,0 38,10 30,48 8,34" />
        </g>
      </g>

      <g
        class="hero-effects__fragment hero-effects__fragment--mobile-02"
        transform="translate(330 360)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,8 30,0 44,24 18,38" />
        </g>
      </g>

      <g
        class="hero-effects__fragment hero-effects__fragment--mobile-03"
        transform="translate(45 430)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,0 28,8 20,35 5,25" />
        </g>
      </g>

      <g
        class="hero-effects__fragment hero-effects__fragment--mobile-04"
        transform="translate(245 570)"
      >
        <g class="hero-effects__fragment-inner">
          <polygon points="0,10 25,0 38,22 15,35" />
        </g>
      </g>


      <!-- Energía -->

      <g class="hero-effects__energy">

        <path
          class="hero-effects__energy-line"
          d="M70 650 L190 380"
        />

        <path
          class="hero-effects__energy-line"
          d="M230 680 L350 410"
        />

      </g>


      <!-- Partículas -->

      <g class="hero-effects__particles">

        <circle cx="70" cy="150" r="2" />
        <circle cx="320" cy="130" r="2" />
        <circle cx="160" cy="280" r="2" />
        <circle cx="350" cy="500" r="2" />
        <circle cx="70" cy="560" r="2" />
        <circle cx="280" cy="620" r="2" />

      </g>

    </svg>

  `;

  return effects;
}