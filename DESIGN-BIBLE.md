# Starfall Protocol Design Bible

`Starfall Protocol` should become a third-person cyberpunk action game built for desktop, not a browser toy. The current site is only a mood signal. The real target is a premium installable game with traversal, combat, stealth, hacking, and strong mission structure.

## Reference deep dive

### Mad Max

- strongest lesson: tactile survival fiction with heavy vehicular identity
- borrow:
  - resource scavenging pressure
  - vehicle as extension of the player fantasy
  - harsh environmental tone and faction ecology

### Watch Dogs

- strongest lesson: systemic hacking creates player-expression and mission variety
- borrow:
  - surveillance and environmental manipulation
  - chainable gadget play
  - urban infiltration structure

### Assassin's Creed

- strongest lesson: traversal mastery and readable stealth loops make the world playable
- borrow:
  - parkour readability
  - infiltration/exfiltration cadence
  - layered stealth tools and enemy awareness states

## Game design

### Elevator pitch

A third-person cyberpunk action game where a covert recovery unit infiltrates collapsing smart-city megazones, steals or destroys dangerous network relics, and fights rival corporations, militias, and machine cults over the future of urban infrastructure.

### Pillars

- **Movement first**: sprinting, mantle, vault, slide, climb, descent, and zipline routes must feel good
- **Systemic disruption**: hacking should alter fights, stealth routes, and escape plans
- **Urban extraction fantasy**: every mission needs a clear insertion, objective, and exfil structure
- **Hybrid combat**: gunplay, melee finishers, gadgets, and traversal should interplay cleanly

### Structure

- hub-based open zones rather than one giant empty open world
- districts with repeatable contracts and story missions
- safehouses for upgrades, intel, and narrative
- optional vehicle segments for pursuit and escape

## Game mechanics

### Player verbs

- move
- climb
- scan
- hack
- distract
- breach
- shoot
- melee
- extract

### Combat

- over-the-shoulder shooting
- gadget combos
- takedowns from traversal states
- limited slow-time breach ability for high-pressure encounters
- enemy communication and flanking logic

### Hacking

- traffic/light grid disruption
- camera takeover
- turret hijack
- door and route manipulation
- evidence scrub / identity spoof systems for stealth missions

### Progression

- operator skill trees:
  - infiltration
  - combat
  - cyberwarfare
  - mobility
- weapon kits and cybernetic upgrades
- faction trust and world-state consequences

## Sound design

- smart-city ambience, drone layers, mag-rail thunder, neon rain, distant advertising
- gadgets should sound precise, expensive, and dangerous
- footsteps and cloth should support stealth readability
- enemy VO needs clear state changes: searching, alerted, converging, breaking

## Music design

- cyberpunk score with propulsion, not ambient wallpaper
- stealth music should be tense and minimal
- combat music should escalate through layered percussion and bass rather than just louder volume
- mission-complete cues should feel earned and cool, not heroic fantasy

## Tutorials

The tutorial should be a playable black-site training breach, not a classroom.

### Teach in order

1. movement and parkour route choice
2. scanning and stealth read
3. distraction and gadget use
4. breach combat
5. extraction under pursuit

## Menus

### Front end

- stylish but restrained title screen
- `Continue`, `Operations`, `Loadout`, `Intel`, `Options`

### In-game screens

- operations board
- district map
- loadout bay
- upgrade tree
- enemy/faction codex

Avoid generic hologram clutter. This game needs strong contrast, crisp typography, and focused information hierarchy.

## Production plan

### Vertical slice

- one district
- one safehouse
- one stealth infiltration mission
- one combat-heavy recovery mission
- one vehicle escape sequence

### Engine recommendation

Unreal Engine 5. This project wants a serious third-person action foundation, animation state work, lighting, and shipping-quality presentation.

## Visual and design references

- Mad Max: https://store.steampowered.com/app/234140/Mad_Max/
- Watch Dogs: https://www.ubisoft.com/en-gb/game/watch-dogs
- Assassin's Creed parkour overview: https://www.ubisoft.com/en-us/game/assassins-creed/news/4TA6gKaTvtOC1mOjZIxCZd
