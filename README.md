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
| `job_state_entity`       | string  | auto-detected              | Used to tell a finished load from a machine that was never started                              |
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
| `sensor.<washer>_job_state`           | telling a finished load from a stopped one |
| `switch.<washer>`                     | the start button                          |

The card derives the slug from `entity` (`sensor.lave_linge_machine_state` →
`lave_linge`) and picks up the siblings on its own. Set the options explicitly
when the entities were renamed, or when another integration is used:

```yaml
type: custom:samsung-washing-machine-card
entity: sensor.washer_machine_state
completion_time_entity: sensor.washer_finish_time
job_state_entity: sensor.washer_job_state
start_entity: switch.washer
```

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
