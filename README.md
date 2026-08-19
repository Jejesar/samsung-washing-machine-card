# Samsung Washing Machine Card

Custom Lovelace card for Home Assistant: a compact, [Bubble
Card](https://github.com/Clooos/Bubble-Card) styled row for a washing machine —
name, remaining time, end time and a progress bar while a cycle runs, a start
button when the machine is stopped. Built for the
[SmartThings](https://www.home-assistant.io/integrations/smartthings/)
integration, but every entity it reads is configurable.

```
┌──────────────────────────────────────────┐
│ ⬜  Lave-linge                            │
│     1h34 restant · fin à 17:07           │
│ ▨▨▨▨▨▨▨▨▨░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ ⬜  Lave-linge                       ▶    │
│     Arrêté                                │
└──────────────────────────────────────────┘
```

## Installation via HACS (custom repository)

1. HACS → ⋮ menu (top right) → **Custom repositories**
2. URL: `https://github.com/Jejesar/samsung-washing-machine-card`
   Category: **Dashboard**
3. Search for "Samsung Washing Machine Card" in HACS → Download
4. HACS automatically adds the resource to the dashboard
5. Add the card to a dashboard:

```yaml
type: custom:samsung-washing-machine-card
entity: sensor.lave_linge_machine_state
name: Lave-linge
```

That is the whole configuration for a SmartThings washer: the companion
entities (completion time, job state) are found from the state entity's name.

## Options

| Option                   | Type    | Default                    | Description                                                                                    |
| ------------------------ | ------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| `entity`                 | string  | —                          | **Required.** The entity holding the machine state, e.g. `sensor.<washer>_machine_state`       |
| `name`                   | string  | entity's friendly name     | Name on the first line                                                                          |
| `icon`                   | string  | `mdi:washing-machine`      | Icon in the left button                                                                         |
| `completion_time_entity` | string  | auto-detected              | Timestamp sensor holding the end of the cycle                                                   |
| `remaining_time_entity`  | string  | auto-detected              | Optional; otherwise the remaining time is the completion time minus now                         |
| `job_state_entity`       | string  | auto-detected              | Phase of the cycle, and how a finished load is told from a machine that was never started       |
| `show_job_state`         | boolean | `true`                     | Put the phase in front of the remaining time                                                    |
| `job_state_labels`       | map     | —                          | Override the name of any phase — see [Cycle phase](#cycle-phase)                                |
| `progress_entity`        | string  | —                          | Optional 0-100 (or 0-1) sensor driving the bar — see [Progress](#progress)                      |
| `start_time_entity`      | string  | —                          | Optional timestamp for the start of the cycle — see [Progress](#progress)                       |
| `show_progress_bar`      | boolean | `true`                     | Show the bar while a cycle runs                                                                 |
| `animate_progress`       | boolean | `true`                     | Move the hatch inside the bar (paused respects a stopped cycle, and `prefers-reduced-motion`)   |
| `show_end_time`          | boolean | `true`                     | Append "ends at HH:MM" to the remaining time                                                    |
| `show_start_button`      | boolean | `true`                     | Show the ▶ button when the machine is stopped                                                   |
| `start_entity`           | string  | the washer's `switch.*`     | Entity the ▶ button acts on                                                                     |
| `start_action`           | map     | `switch.turn_on`           | Full action override — see [Start button](#start-button)                                        |
| `start_icon`             | string  | `mdi:play`                 | Icon of the start button                                                                        |
| `tap_action`             | map     | `more-info`                | Action of the left icon button                                                                  |
| `running_states`         | list    | `run, running, on, wash, washing` | States that count as "a cycle is running"                                                |
| `paused_states`          | list    | `pause, paused`            | States that count as paused                                                                     |
| `finished_states`        | list    | `finish, finished, complete, completed` | Job states that mean the load is done                                              |
| `language`               | string  | Home Assistant's language  | `en`, `fr` or `nl`                                                                              |
| `labels`                 | map     | —                          | Override any single string — see [Wording](#wording)                                            |

## Entities

The SmartThings integration exposes a washer as several entities sharing the
device slug:

| Entity                                | Used for                                  |
| ------------------------------------- | ----------------------------------------- |
| `sensor.<washer>_machine_state`       | `entity` — run / pause / stop             |
| `sensor.<washer>_completion_time`     | remaining time, end time, progress        |
| `sensor.<washer>_job_state`           | phase of the cycle, and telling a finished load from a stopped one |
| `switch.<washer>`                     | the start button                          |

The card derives the slug from `entity` (`sensor.lave_linge_machine_state` →
`lave_linge`) and picks up the siblings on its own, including the French names
the integration uses in a French Home Assistant (`_temps_restant`,
`_etat_du_cycle`).

**A "remaining time" entity holding a date is an end time.** Some locales
publish the end of the cycle under that name; point `completion_time_entity` at
it and everything works, since the card reads the value, not the name. The same
entity often parks on `stop` when nothing runs — that is taken as a stopped
machine, whatever the machine state says. Set the options explicitly
when the entities were renamed, or when another integration is used:

```yaml
type: custom:samsung-washing-machine-card
entity: sensor.washer_machine_state
completion_time_entity: sensor.washer_finish_time
job_state_entity: sensor.washer_job_state
start_entity: switch.washer
```

## Cycle phase

With a job state entity, the subtitle leads with the phase the machine is in —
`Rinsing · 22 min remaining · ends at 20:33`. The SmartThings values are
translated in the card's three languages:

| Value              | English         | Français           |
| ------------------ | --------------- | ------------------ |
| `weight_sensing`   | Weighing        | Pesée              |
| `pre_wash`         | Pre-wash        | Prélavage          |
| `wash` / `ai_wash` | Washing         | Lavage             |
| `rinse`/`ai_rinse` | Rinsing         | Rinçage            |
| `spin` / `ai_spin` | Spinning        | Essorage           |
| `drying`           | Drying          | Séchage            |
| `cooling`          | Cooling         | Refroidissement    |
| `air_wash`         | Air wash        | Lavage à l'air     |
| `delay_wash`       | Delayed start   | Départ différé     |
| `wrinkle_prevent`  | Wrinkle prevent | Anti-froissage     |
| `freeze_protection`| Freeze protection | Protection antigel |

Anything else is shown as-is, underscores removed. `none` and the finished
values are not phases and print nothing. Rename any of them with
`job_state_labels`, keyed by the raw value:

```yaml
job_state_labels:
    weight_sensing: Pesée du linge
    wrinkle_prevent: Défroissage
```

Set `show_job_state: false` to keep the shorter `1h34 remaining · ends at 17:07`.

## Progress

SmartThings publishes *when* a cycle ends but never how long it was going to
take, so the bar needs a second reference point. The card uses, in order:

1. `progress_entity` — a sensor already holding a percentage;
2. `start_time_entity` — a timestamp for the start of the cycle;
3. otherwise, the moment it first saw the machine running, remembered in the
   browser's local storage per entity.

With option 3 the bar is correct from the first cycle the card sees, survives a
page reload, and re-reads the completion time on every update — when the washer
pushes its estimate back, the bar slows down instead of jumping. It cannot
recover a cycle that started before the card was ever displayed: there the bar
falls back to a plain animated hatch until the cycle ends.

To get an exact bar even in that case, record the start yourself with an
`input_datetime` helper and an automation on the washer starting, then point
`start_time_entity` at it:

```yaml
# configuration.yaml
input_datetime:
    washer_started:
        has_date: true
        has_time: true
```

```yaml
# automation
triggers:
    - trigger: state
      entity_id: sensor.lave_linge_machine_state
      to: run
actions:
    - action: input_datetime.set_datetime
      target:
          entity_id: input_datetime.washer_started
      data:
          timestamp: "{{ now().timestamp() }}"
```

```yaml
type: custom:samsung-washing-machine-card
entity: sensor.lave_linge_machine_state
start_time_entity: input_datetime.washer_started
```

## Start button

The button appears when the machine is not running. By default it calls
`switch.turn_on` on the washer's switch entity, which is what starts the
programme selected on the machine — **Smart Control must be enabled on the
washer itself**, otherwise SmartThings refuses the command and nothing happens.

Anything else goes through `start_action`, which takes the usual Lovelace action
shape:

```yaml
start_action:
    action: perform-action
    perform_action: script.turn_on
    target:
        entity_id: script.start_washer
```

## Android Live Update (status bar pill)

Home Assistant's Android app can pin a **Live Update** notification while a
cycle runs: a countdown pill in the status bar, a progress bar on the lock
screen and the always-on display — Android 16's answer to the iPhone Dynamic
Island. This is a notification sent by Home Assistant to the phone, so it is
driven by an automation, not by the card; the repository ships a blueprint for
it.

[![Open your Home Assistant instance and show the blueprint import dialog.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2FJejesar%2Fsamsung-washing-machine-card%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Fsamsung_washing_machine_live_update.yaml)

Or: Settings → Automations & scenes → Blueprints → Import blueprint, with

```
https://github.com/Jejesar/samsung-washing-machine-card/blob/main/blueprints/automation/samsung_washing_machine_live_update.yaml
```

The blueprint asks for the washer state entity, the completion time entity and
the phones, then posts the notification when the machine starts, refreshes it
every minute, clears it when the cycle ends and — optionally — sends a plain
"cycle finished" notification. Like the card, it needs no helper entity: the
start of the cycle is the state entity's `last_changed`.

The message leads with the phase — `Rinçage · 22 min restant · fin à 20:33` —
using the same names as the card; turn it off with *Show the current phase*.

**Fill in the job state entity.** It is optional, but it is the only reliable
way to know a load is over: a Samsung washer can sit on `run` after the
programme — wrinkle care, an extra spin, or simply an idle machine that never
went back to `stop` — and it republishes a completion time for the programme
still selected on the dial. Without the job state the blueprint takes that for
a new cycle and posts a fresh countdown. With it, `finish` (or `none`) ends the
notification whatever the machine state says. `Finished job states` holds the
values that count as over; drop `none` from the list if your washer idles the
job state at `none` between the start of a cycle and its first real phase, as
the notification would otherwise wait a minute before appearing.

Two more safety nets need no configuration: an end time more than five minutes
behind clears the notification even without a job state entity, and an
`unavailable` state — an integration dropout — is ignored instead of being read
as the end of the cycle.

If a notification is stuck on a phone, clear it by hand from Developer tools →
Actions; the tag is the state entity id with dots replaced by underscores:

```yaml
action: notify.mobile_app_<your_phone>
data:
    message: clear_notification
    data:
        tag: washing_machine_sensor_lave_linge_machine_state
```

**Several phones need one automation, not one each.** The phone input takes as
many devices as you like and the notification is sent to each of them. A
[notify group](https://www.home-assistant.io/integrations/group/#notify-groups)
works too — it forwards the whole payload, Live Update keys included — through
the *Notification service* field, which also accepts a comma separated list:

```yaml
# configuration.yaml — optional, only if you prefer a group
notify:
    - platform: group
      name: phones
      services:
          - action: mobile_app_pixel_9
          - action: mobile_app_galaxy_s24
```

```
Notification service: notify.phones
```

Requirements and quirks, none of which the automation can work around:

- **Android 16 or later**, with a recent companion app. On older Android the
  same notification still posts, as an ordinary one without the pill.
- **On Samsung phones**, the status bar chip only shows once *Live
  notifications for all apps* is enabled in the developer options.
- The title cannot change while the Live Update is on screen — only the
  message, the progress and the countdown do.
- iOS is not covered: Live Activities need an app extension, and the companion
  app only ships the ones it defines itself.

Written out by hand, the notification is a plain service call:

```yaml
action: notify.mobile_app_<your_phone>
data:
    title: Washing machine
    message: 1h34 remaining · ends at 17:07
    data:
        tag: washing_machine
        live_update: true
        progress: 8400
        progress_max: 14040
        chronometer: true
        when: 5640
        when_relative: true
        notification_icon: mdi:washing-machine
        color: "#2196F3"
```

`tag` is what ties the updates together: sending the same tag again refreshes
the notification silently, and `message: clear_notification` with that tag
removes it. See the [companion app
documentation](https://companion.home-assistant.io/docs/notifications/live-activities/).


## Wording

The card ships with English, French and Dutch, following the Home Assistant
language. Single strings can be replaced without switching language:

```yaml
labels:
    remaining: "{time} left"
    ends_at: "done at {time}"
    stopped: "Idle"
```

Keys: `running`, `stopped`, `paused`, `finished`, `unavailable`, `remaining`,
`ends_at`, `start`, `separator`. `{time}` is substituted.

## Theming

Bubble Card's variables are used when they exist, so the card matches the rest
of a Bubble dashboard on its own; without Bubble Card it falls back to the
standard Home Assistant theme variables.

| Variable                          | Falls back to                  |
| --------------------------------- | ------------------------------ |
| `--bubble-border-radius`          | `24px`                         |
| `--bubble-button-border-radius`   | `16px`                         |
| `--bubble-button-background-color`| `--secondary-background-color` |
| `--bubble-accent-color`           | `--primary-color`              |
| `--bubble-button-text-color`      | `--primary-text-color`         |
| `--bubble-secondary-text-color`   | `--secondary-text-color`       |

Override them per card through `card_mod`, or globally in the theme.

## Visual editor

The card has a visual editor: everything above except `labels`, `tap_action`,
`start_action` and the state lists is editable from the UI.
