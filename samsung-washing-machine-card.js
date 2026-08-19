/*!
 * Samsung Washing Machine Card
 * Custom Lovelace card: a Bubble Card styled row for a washing machine —
 * name, remaining time, end time and a progress bar while it runs, a start
 * button when it is stopped.
 * Designed for the SmartThings integration.
 */

const CARD_VERSION = "1.3.0";

const DEFAULTS = {
  icon: "mdi:washing-machine",
  running_states: ["run", "running", "on", "wash", "washing"],
  paused_states: ["pause", "paused"],
  finished_states: ["finish", "finished", "complete", "completed"],
  stopped_time_values: ["stop", "stopped", "none"],
  show_start_button: true,
  show_progress_bar: true,
  show_job_state: true,
  animate_progress: true,
  tap_action: { action: "more-info" },
};

// Entities the card looks for on its own, in order, when the matching option
// is not set. Matched against the entity_id, then the friendly name.
const AUTO_SUFFIXES = {
  completion_time_entity: ["completion_time", "finish_time", "end_time", "heure_de_fin"],
  remaining_time_entity: ["remaining_time", "time_remaining", "temps_restant"],
  job_state_entity: ["job_state", "etat_du_cycle", "cycle_state", "job_status"],
};

const TRANSLATIONS = {
  en: {
    running: "Running",
    stopped: "Stopped",
    paused: "Paused",
    finished: "Finished",
    unavailable: "Unavailable",
    remaining: "{time} remaining",
    ends_at: "ends at {time}",
    start: "Start",
    separator: " · ",
  },
  fr: {
    running: "En marche",
    stopped: "Arrêté",
    paused: "En pause",
    finished: "Terminé",
    unavailable: "Indisponible",
    remaining: "{time} restant",
    ends_at: "fin à {time}",
    start: "Démarrer",
    separator: " · ",
  },
  nl: {
    running: "Bezig",
    stopped: "Gestopt",
    paused: "Gepauzeerd",
    finished: "Klaar",
    unavailable: "Niet beschikbaar",
    remaining: "nog {time}",
    ends_at: "klaar om {time}",
    start: "Starten",
    separator: " · ",
  },
};

// SmartThings job states. "none" is deliberately absent: an idle job state is
// not a phase to display.
const JOB_STATES = {
  en: {
    air_wash: "Air wash",
    ai_rinse: "AI rinse",
    ai_spin: "AI spin",
    ai_wash: "AI wash",
    cooling: "Cooling",
    delay_wash: "Delayed start",
    drying: "Drying",
    finish: "Finished",
    freeze_protection: "Freeze protection",
    pre_wash: "Pre-wash",
    rinse: "Rinsing",
    spin: "Spinning",
    wash: "Washing",
    weight_sensing: "Weighing",
    wrinkle_prevent: "Wrinkle prevent",
  },
  fr: {
    air_wash: "Lavage à l'air",
    ai_rinse: "Rinçage AI",
    ai_spin: "Essorage AI",
    ai_wash: "Lavage AI",
    cooling: "Refroidissement",
    delay_wash: "Départ différé",
    drying: "Séchage",
    finish: "Terminé",
    freeze_protection: "Protection antigel",
    pre_wash: "Prélavage",
    rinse: "Rinçage",
    spin: "Essorage",
    wash: "Lavage",
    weight_sensing: "Pesée",
    wrinkle_prevent: "Anti-froissage",
  },
  nl: {
    air_wash: "Luchtwas",
    ai_rinse: "AI-spoelen",
    ai_spin: "AI-centrifugeren",
    ai_wash: "AI-wassen",
    cooling: "Koelen",
    delay_wash: "Uitgestelde start",
    drying: "Drogen",
    finish: "Klaar",
    freeze_protection: "Vorstbeveiliging",
    pre_wash: "Voorwas",
    rinse: "Spoelen",
    spin: "Centrifugeren",
    wash: "Wassen",
    weight_sensing: "Wegen",
    wrinkle_prevent: "Kreukbeveiliging",
  },
};

const UNKNOWN_STATES = ["unknown", "unavailable", "none", ""];

const fireEvent = (node, type, detail) => {
  const event = new Event(type, { bubbles: true, cancelable: false, composed: true });
  event.detail = detail;
  node.dispatchEvent(event);
  return event;
};

const haptic = (kind = "light") => {
  fireEvent(window, "haptic", kind);
  if (navigator.vibrate) navigator.vibrate(kind === "medium" ? 20 : 10);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toList = (value) =>
  (Array.isArray(value) ? value : [value]).filter((v) => v !== undefined && v !== null).map((v) => String(v).toLowerCase());

/** Seconds held by a state that may be a number, "HH:MM:SS" or "MM:SS". */
const parseDuration = (stateObj) => {
  if (!stateObj || UNKNOWN_STATES.includes(String(stateObj.state).toLowerCase())) return null;
  const raw = String(stateObj.state).trim();

  if (raw.includes(":")) {
    const parts = raw.split(":").map(Number);
    if (parts.some(Number.isNaN)) return null;
    // "HH:MM:SS" or "MM:SS"
    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  }

  const value = Number(raw);
  if (Number.isNaN(value)) return null;
  const unit = String(stateObj.attributes.unit_of_measurement || "").toLowerCase();
  if (unit.startsWith("s")) return value;
  if (unit.startsWith("h")) return value * 3600;
  // SmartThings reports minutes and often without a unit at all.
  return value * 60;
};

// A date has to look like one before it is parsed: Date.parse("90") happily
// answers 1990, which would turn a 90 minute countdown into a date.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

/** Epoch ms held by a timestamp state, or null when it cannot be read. */
const parseTimestamp = (stateObj) => {
  if (!stateObj) return null;
  const raw = String(stateObj.state).trim();
  if (UNKNOWN_STATES.includes(raw.toLowerCase()) || !ISO_DATE.test(raw)) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
};

class SamsungWashingMachineCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._ticker = null;
  }

  static getConfigElement() {
    return document.createElement("samsung-washing-machine-card-editor");
  }

  static getStubConfig(hass) {
    const states = hass ? Object.keys(hass.states) : [];
    const washer = states.find((e) => /washer|washing|lave.?linge|laveuse/i.test(e) && e.endsWith("machine_state"));
    return { entity: washer || states.find((e) => /washer|lave.?linge/i.test(e)) || "" };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You need to define an entity (the washer state entity)");
    }
    this._config = { ...DEFAULTS, ...config };
    this._built = false;
    this.shadowRoot.innerHTML = "";
    if (this._hass) this._build();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) this._build();
    this._update();
  }

  connectedCallback() {
    // Remaining time and progress are derived from the clock, not from a state
    // change, so the card refreshes itself between Home Assistant updates.
    this._ticker = setInterval(() => {
      if (this._hass && this._built) this._update();
    }, 10000);
  }

  disconnectedCallback() {
    if (this._ticker) clearInterval(this._ticker);
    this._ticker = null;
  }

  getCardSize() {
    return 2;
  }

  getGridOptions() {
    // "auto" lets the sections view measure the card, so the row keeps its
    // height whether or not the progress bar is showing.
    return { columns: "full", min_columns: 6, rows: "auto" };
  }

  /* ---------- config helpers ---------- */

  get _lang() {
    return (this._config.language || (this._hass && this._hass.language) || "en").slice(0, 2);
  }

  /**
   * Human name of the phase the machine is in, or null when there is nothing
   * worth showing. Falls back to the entity's own translated state, so a value
   * this card does not know about still reads better than a raw enum key.
   */
  _jobPhase() {
    if (this._config.show_job_state === false) return null;
    const stateObj = this._state(this._entityFor("job_state_entity"));
    if (!stateObj) return null;

    const raw = String(stateObj.state).toLowerCase();
    if (UNKNOWN_STATES.includes(raw)) return null;
    // "Finished" is already the subtitle of a stopped machine; repeating it
    // next to a countdown would be contradictory.
    if (toList(this._config.finished_states).includes(raw)) return null;

    const names = { ...JOB_STATES.en, ...(JOB_STATES[this._lang] || {}), ...(this._config.job_state_labels || {}) };
    if (names[raw]) return names[raw];

    const translated = this._hass.formatEntityState ? this._hass.formatEntityState(stateObj) : null;
    if (translated && translated.toLowerCase() !== raw) return translated;
    return raw.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  }

  get _t() {
    return { ...TRANSLATIONS.en, ...(TRANSLATIONS[this._lang] || {}), ...(this._config.labels || {}) };
  }

  /** Resolve an option to an entity id, guessing from the main entity's name. */
  _entityFor(key) {
    if (this._config[key] !== undefined) return this._config[key] || null;

    const suffixes = AUTO_SUFFIXES[key] || [];
    if (!suffixes.length || !this._hass) return null;

    // The washer's entities share the device slug: sensor.washer_machine_state,
    // sensor.washer_completion_time, ... Strip the known suffixes off the main
    // entity to get that slug, then look for a sibling.
    const [, objectId = ""] = this._config.entity.split(".");
    let slug = objectId;
    ["_machine_state", "_job_state", "_state"].forEach((s) => {
      if (slug.endsWith(s)) slug = slug.slice(0, -s.length);
    });

    const candidates = Object.keys(this._hass.states);
    for (const suffix of suffixes) {
      const hit = candidates.find((e) => e.startsWith(`sensor.${slug}_`) && e.endsWith(suffix));
      if (hit) return hit;
    }
    return null;
  }

  _state(entityId) {
    return entityId && this._hass ? this._hass.states[entityId] : undefined;
  }

  /* ---------- machine state ---------- */

  /** "running" | "paused" | "finished" | "stopped" | "unavailable" */
  _machineState() {
    const stateObj = this._state(this._config.entity);
    if (!stateObj) return "unavailable";
    const state = String(stateObj.state).toLowerCase();
    if (["unavailable", "unknown"].includes(state)) return "unavailable";

    // A time entity that reads "stop" rather than a value is the integration
    // saying there is no cycle — trust it over a machine state left on "run".
    const timeEntities = ["completion_time_entity", "remaining_time_entity"];
    const halted = timeEntities.some((key) => {
      const obj = this._state(this._entityFor(key));
      return obj && toList(this._config.stopped_time_values).includes(String(obj.state).toLowerCase());
    });
    if (halted) return "stopped";

    if (toList(this._config.running_states).includes(state)) return "running";
    if (toList(this._config.paused_states).includes(state)) return "paused";

    // Stopped covers "finished" too: SmartThings keeps machine_state at "stop"
    // once a cycle ends and only job_state says the load is done.
    const job = this._state(this._entityFor("job_state_entity"));
    if (job && toList(this._config.finished_states).includes(String(job.state).toLowerCase())) return "finished";
    if (toList(this._config.finished_states).includes(state)) return "finished";
    return "stopped";
  }

  /**
   * End of the cycle, epoch ms, or null. Integrations disagree on which entity
   * carries it: a "remaining time" sensor holding a timestamp — SmartThings in
   * some locales — is an end time under a misleading name, so both entities are
   * tried before giving up.
   */
  _endTimestamp() {
    const completion = parseTimestamp(this._state(this._entityFor("completion_time_entity")));
    if (completion !== null) return completion;
    return parseTimestamp(this._state(this._entityFor("remaining_time_entity")));
  }

  /** Seconds left in the running cycle, or null when unknown. */
  _remainingSeconds(endTs) {
    const explicit = parseDuration(this._state(this._entityFor("remaining_time_entity")));
    if (explicit !== null) return Math.max(0, explicit);
    if (endTs === null) return null;
    return Math.max(0, Math.round((endTs - Date.now()) / 1000));
  }

  /* ---------- run tracking ---------- */

  get _storageKey() {
    return `samsung-washing-machine-card:${this._config.entity}`;
  }

  _loadRun() {
    try {
      const raw = window.localStorage.getItem(this._storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  _saveRun(run) {
    try {
      if (run) window.localStorage.setItem(this._storageKey, JSON.stringify(run));
      else window.localStorage.removeItem(this._storageKey);
    } catch (err) {
      /* private mode, quota, ... — the card just loses its progress reference */
    }
  }

  /**
   * Fraction of the cycle already done, 0..1, or null when it cannot be known.
   *
   * SmartThings publishes when a cycle ends but never how long it was going to
   * take, so without a helper entity the card remembers when the machine
   * started and measures against that. The end time is re-read on every update:
   * when the washer pushes its estimate back the bar slows down instead of
   * jumping.
   */
  _progress(running, endTs) {
    const explicit = this._state(this._config.progress_entity);
    if (explicit && !UNKNOWN_STATES.includes(String(explicit.state).toLowerCase())) {
      const value = Number(explicit.state);
      if (!Number.isNaN(value)) return clamp(value > 1 ? value / 100 : value, 0, 1);
    }

    if (!running) {
      if (this._loadRun()) this._saveRun(null);
      return null;
    }

    const now = Date.now();
    let startTs = parseTimestamp(this._state(this._config.start_time_entity));

    if (startTs === null) {
      const run = this._loadRun();
      // A stored start in the future means the clock moved or the entry is
      // stale — start the measurement over rather than showing a broken bar.
      if (run && typeof run.start === "number" && run.start <= now) startTs = run.start;
      else this._saveRun({ start: now });
    }

    if (startTs === null || endTs === null || endTs <= startTs) return null;
    return clamp((now - startTs) / (endTs - startTs), 0, 1);
  }

  /* ---------- formatting ---------- */

  _formatDuration(seconds) {
    if (seconds === null) return null;
    const total = Math.max(0, Math.round(seconds / 60));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}`;
    return `${minutes} min`;
  }

  _formatTime(ts) {
    if (ts === null) return null;
    const locale = (this._hass && this._hass.locale) || {};
    const format = locale.time_format;
    const options = { hour: "2-digit", minute: "2-digit" };
    if (format === "24") options.hour12 = false;
    else if (format === "12") options.hour12 = true;
    return new Intl.DateTimeFormat(this._hass.locale?.language || this._hass.language || undefined, options).format(
      new Date(ts),
    );
  }

  /* ---------- actions ---------- */

  _handleTap() {
    const action = this._config.tap_action || DEFAULTS.tap_action;
    haptic("light");
    this._performAction(action, this._config.entity);
  }

  _handleStart() {
    haptic("medium");
    const configured = this._config.start_action;
    if (configured) {
      this._performAction(configured, this._config.start_entity || this._config.entity);
      return;
    }

    // Default: power the washer on through its SmartThings switch, which is
    // what starts the selected programme once remote control is enabled.
    const target = this._config.start_entity || this._config.entity.replace(/^[^.]+\./, "switch.").replace(/_machine_state$|_job_state$/, "");
    const [domain] = target.split(".");
    this._hass.callService(domain === "switch" || domain === "button" ? domain : "homeassistant", domain === "button" ? "press" : "turn_on", {
      entity_id: target,
    });
  }

  _performAction(action, defaultEntity) {
    const cfg = typeof action === "string" ? { action } : action || {};
    switch (cfg.action) {
      case "none":
        return;
      case "toggle":
        this._hass.callService("homeassistant", "toggle", { entity_id: cfg.entity || defaultEntity });
        return;
      case "call-service":
      case "perform-action": {
        const service = cfg.perform_action || cfg.service;
        if (!service) return;
        const [domain, name] = service.split(".");
        if (!domain || !name) return;
        this._hass.callService(domain, name, cfg.data || cfg.service_data || {}, cfg.target);
        return;
      }
      case "navigate":
        if (cfg.navigation_path) {
          history.pushState(null, "", cfg.navigation_path);
          fireEvent(window, "location-changed", {});
        }
        return;
      case "url":
        if (cfg.url_path) window.open(cfg.url_path);
        return;
      default:
        fireEvent(this, "hass-more-info", { entityId: cfg.entity || defaultEntity });
    }
  }

  /* ---------- rendering ---------- */

  _build() {
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; }
      ha-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        overflow: hidden;
        /* Bubble Card sets these globally when it is installed and themed, so
           the card blends in; the fallbacks keep stock HA looking right. */
        --swm-radius: var(--bubble-border-radius, 24px);
        --swm-inner-radius: var(--bubble-button-border-radius, 16px);
        --swm-surface: var(--bubble-button-background-color,
          var(--bubble-secondary-background-color, var(--secondary-background-color)));
        --swm-accent: var(--bubble-accent-color, var(--primary-color));
        --swm-primary-text: var(--bubble-button-text-color, var(--primary-text-color));
        --swm-secondary-text: var(--bubble-secondary-text-color, var(--secondary-text-color));
        border-radius: var(--swm-radius);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 40px;
      }
      .icon-btn, .start-btn {
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: none;
        border-radius: var(--swm-inner-radius);
        background: var(--swm-surface);
        color: var(--swm-primary-text);
        cursor: pointer;
        transition: transform 90ms ease, background 150ms ease, color 150ms ease;
      }
      .icon-btn:active, .start-btn:active { transform: scale(0.92); }
      .icon-btn ha-icon, .start-btn ha-icon { --mdc-icon-size: 22px; }
      .icon-btn.running { color: var(--swm-accent); }
      .start-btn:hover { background: var(--swm-accent); color: var(--text-primary-color, #fff); }
      .start-btn[hidden] { display: none; }
      .info {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-width: 0;
        line-height: 1.25;
      }
      .name {
        font-size: 14px;
        font-weight: 600;
        color: var(--swm-primary-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sub {
        font-size: 12px;
        font-weight: 400;
        color: var(--swm-secondary-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sub[hidden] { display: none; }
      .bar {
        position: relative;
        height: 16px;
        border-radius: calc(var(--swm-inner-radius) * 0.6);
        background: var(--swm-surface);
        overflow: hidden;
      }
      .bar[hidden] { display: none; }
      .fill {
        height: 100%;
        width: 0%;
        border-radius: inherit;
        background-color: var(--swm-accent);
        /* Bubble Card's moving hatch, so a running cycle reads as "alive" even
           while the percentage barely moves. */
        background-image: repeating-linear-gradient(
          -45deg,
          rgba(255, 255, 255, 0.22) 0 6px,
          rgba(255, 255, 255, 0) 6px 12px
        );
        background-size: 17px 17px;
      }
      /* The width only animates once the bar has been painted, otherwise the
         first render slides up from zero every time the card is rebuilt. */
      .fill.ready { transition: width 1s linear; }
      .fill.animated { animation: swm-stripes 1.2s linear infinite; }
      .fill.indeterminate {
        width: 100% !important;
        opacity: 0.55;
        transition: none;
      }
      @keyframes swm-stripes {
        from { background-position: 0 0; }
        to { background-position: 17px 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .fill.animated { animation: none; }
      }
    `;

    const card = document.createElement("ha-card");

    const row = document.createElement("div");
    row.className = "row";

    const iconBtn = document.createElement("button");
    iconBtn.className = "icon-btn";
    iconBtn.addEventListener("click", () => this._handleTap());
    const icon = document.createElement("ha-icon");
    iconBtn.appendChild(icon);
    row.appendChild(iconBtn);

    const info = document.createElement("div");
    info.className = "info";
    const name = document.createElement("div");
    name.className = "name";
    const sub = document.createElement("div");
    sub.className = "sub";
    info.appendChild(name);
    info.appendChild(sub);
    row.appendChild(info);

    const startBtn = document.createElement("button");
    startBtn.className = "start-btn";
    const startIcon = document.createElement("ha-icon");
    startIcon.setAttribute("icon", this._config.start_icon || "mdi:play");
    startBtn.appendChild(startIcon);
    startBtn.addEventListener("click", () => this._handleStart());
    row.appendChild(startBtn);

    card.appendChild(row);

    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.className = "fill";
    bar.appendChild(fill);
    card.appendChild(bar);

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(card);

    this._els = { card, iconBtn, icon, name, sub, startBtn, bar, fill };
    this._built = true;
  }

  _update() {
    const cfg = this._config;
    const t = this._t;
    const els = this._els;
    const stateObj = this._state(cfg.entity);

    const machineState = this._machineState();
    const running = machineState === "running" || machineState === "paused";

    const endTs = this._endTimestamp();
    const remaining = running ? this._remainingSeconds(endTs) : null;
    const progress = this._progress(running, endTs);

    /* --- name + icon --- */
    els.name.textContent =
      cfg.name || (stateObj && stateObj.attributes.friendly_name) || cfg.entity.split(".").pop().replace(/_/g, " ");
    els.icon.setAttribute("icon", cfg.icon || (stateObj && stateObj.attributes.icon) || DEFAULTS.icon);
    els.iconBtn.classList.toggle("running", machineState === "running");

    /* --- subtitle --- */
    let text;
    if (machineState === "unavailable") {
      text = t.unavailable;
    } else if (running) {
      const parts = [];
      const phase = this._jobPhase();
      const left = this._formatDuration(remaining);
      const end = this._formatTime(endTs);
      if (phase) parts.push(phase);
      if (left) parts.push(t.remaining.replace("{time}", left));
      if (end && cfg.show_end_time !== false) parts.push(t.ends_at.replace("{time}", end));
      text = parts.length ? parts.join(t.separator) : machineState === "paused" ? t.paused : t.running;
      // Paused already prefixes the line, so a phase there would read twice.
      if (machineState === "paused" && parts.length) text = `${t.paused}${t.separator}${text}`;
    } else if (machineState === "finished") {
      text = t.finished;
    } else {
      text = t.stopped;
    }
    els.sub.textContent = text;
    els.sub.hidden = !text;

    /* --- progress bar --- */
    const barVisible = cfg.show_progress_bar !== false && running;
    els.bar.hidden = !barVisible;
    if (barVisible) {
      const indeterminate = progress === null;
      els.fill.classList.toggle("indeterminate", indeterminate);
      els.fill.classList.toggle("animated", cfg.animate_progress !== false && machineState === "running");
      els.fill.style.width = indeterminate ? "100%" : `${(progress * 100).toFixed(1)}%`;
      if (!els.fill.classList.contains("ready")) {
        requestAnimationFrame(() => els.fill.classList.add("ready"));
      }
    }

    /* --- start button --- */
    els.startBtn.hidden = cfg.show_start_button === false || running || machineState === "unavailable";
    els.startBtn.title = t.start;
    els.startBtn.setAttribute("aria-label", t.start);
  }
}

/* ------------------------------------------------------------------ *
 * Visual editor
 * ------------------------------------------------------------------ */

const LABELS = {
  entity: "Washer state entity (required)",
  name: "Name",
  icon: "Icon",
  completion_time_entity: "Completion time entity",
  remaining_time_entity: "Remaining time entity",
  progress_entity: "Progress entity",
  start_time_entity: "Cycle start time entity",
  job_state_entity: "Job state entity",
  show_progress_bar: "Show the progress bar",
  show_job_state: "Show the current phase",
  animate_progress: "Animate the progress bar",
  show_end_time: "Show the end time",
  show_start_button: "Show the start button",
  start_entity: "Entity started by the button",
  start_icon: "Start button icon",
  language: "Language",
  advanced: "Advanced",
};

const HELPERS = {
  entity: "SmartThings: sensor.<washer>_machine_state",
  completion_time_entity: "Timestamp sensor; auto-detected from the state entity when left empty",
  remaining_time_entity: "Optional; otherwise the remaining time is the completion time minus now",
  progress_entity: "Optional 0-100 sensor; otherwise progress is measured from the start of the cycle",
  start_time_entity: "Optional; otherwise the card remembers when the cycle started",
  job_state_entity: "Shows the current phase, and tells a finished load from a stopped machine",
  start_entity: "Defaults to the washer's switch entity",
  language: "Defaults to the Home Assistant language",
};

const SCHEMA = [
  { name: "entity", required: true, selector: { entity: {} } },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "name", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
    ],
  },
  { name: "completion_time_entity", selector: { entity: { domain: "sensor" } } },
  { name: "remaining_time_entity", selector: { entity: { domain: "sensor" } } },
  { name: "job_state_entity", selector: { entity: { domain: "sensor" } } },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "show_progress_bar", selector: { boolean: {} } },
      { name: "animate_progress", selector: { boolean: {} } },
      { name: "show_job_state", selector: { boolean: {} } },
      { name: "show_end_time", selector: { boolean: {} } },
      { name: "show_start_button", selector: { boolean: {} } },
    ],
  },
  { name: "start_entity", selector: { entity: { domain: ["switch", "button", "script", "scene"] } } },
  {
    name: "",
    title: LABELS.advanced,
    type: "expandable",
    schema: [
      { name: "progress_entity", selector: { entity: { domain: "sensor" } } },
      { name: "start_time_entity", selector: { entity: { domain: "sensor" } } },
      { name: "start_icon", selector: { icon: {} } },
      {
        name: "language",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "en", label: "English" },
              { value: "fr", label: "Français" },
              { value: "nl", label: "Nederlands" },
            ],
          },
        },
      },
    ],
  },
];

const BOOLEAN_KEYS = ["show_progress_bar", "animate_progress", "show_end_time", "show_start_button", "show_job_state"];
const BOOLEAN_DEFAULTS = {
  show_progress_bar: true,
  animate_progress: true,
  show_end_time: true,
  show_start_button: true,
  show_job_state: true,
};

class SamsungWashingMachineCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...config };
    if (!this._form) this._render();
    else this._form.data = this._data;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._form) this._render();
    else this._form.hass = hass;
  }

  get _data() {
    const data = { ...this._config };
    BOOLEAN_KEYS.forEach((k) => {
      data[k] = this._config[k] ?? BOOLEAN_DEFAULTS[k];
    });
    // Nested keys live flat in the YAML; ha-form only needs them present.
    return data;
  }

  _onChanged(ev) {
    ev.stopPropagation();
    const value = { ...ev.detail.value };
    const next = { ...this._config, ...value };
    Object.keys(value).forEach((k) => {
      const v = value[k];
      if (v === "" || v === undefined || v === null) delete next[k];
      // Keep the YAML free of values that only restate a default.
      else if (BOOLEAN_DEFAULTS[k] !== undefined && v === BOOLEAN_DEFAULTS[k]) delete next[k];
    });
    this._config = next;
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }),
    );
  }

  _render() {
    if (!this._hass) return;
    this.shadowRoot.innerHTML = "";
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.schema = SCHEMA;
    form.data = this._data;
    form.computeLabel = (schema) => LABELS[schema.name] || schema.name;
    form.computeHelper = (schema) => HELPERS[schema.name] || "";
    form.addEventListener("value-changed", (ev) => this._onChanged(ev));
    this._form = form;
    this.shadowRoot.appendChild(form);
  }
}

if (!customElements.get("samsung-washing-machine-card-editor")) {
  customElements.define("samsung-washing-machine-card-editor", SamsungWashingMachineCardEditor);
}

if (!customElements.get("samsung-washing-machine-card")) {
  customElements.define("samsung-washing-machine-card", SamsungWashingMachineCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "samsung-washing-machine-card",
  name: "Samsung Washing Machine Card",
  description: "Bubble Card styled washing machine row with remaining time, progress bar and a start button",
  preview: true,
  documentationURL: "https://github.com/Jejesar/samsung-washing-machine-card",
});

console.info(
  `%c SAMSUNG-WASHING-MACHINE-CARD %c v${CARD_VERSION} `,
  "color: white; background: #1428a0; font-weight: 700;",
  "color: #1428a0; background: white; font-weight: 700;",
);
