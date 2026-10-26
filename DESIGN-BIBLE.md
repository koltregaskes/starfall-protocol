# Starfall Protocol Design Bible

Starfall Protocol is a third-person browser game about opening one civilian evacuation lane. The whole game is the Aurelion Gate campaign: three missions on the orbital dock, played in order, in this build. There is no later campaign, district map, or installable game hiding behind this one.

## The whole game

Goal. Open the civilian evacuation lane by finishing Ghost Signal, Storm Window, and Cinder Vector, in that order.

Win. You win Starfall Protocol when the skiff clears the storm gate at the end of Cinder Vector.

Loss. You lose the session if your vitals or the skiff hull hit zero before that gate is open.

A new player reads those three rules on the safehouse board before deploying. The same win and loss lines stay on the mission HUD. Review URLs can pose a debrief for verification. They do not play the campaign and they do not count as winning the game.

## The three missions

1. Ghost Signal. Hold E on the skiff ring to insert. Cross the berth, press Q at the overlook, hold E at the archive terminal, hold E to take the navigation seed, shoot the relay drone and the ceiling gun, then hold E at the berth to extract.
2. Storm Window. The seed is already aboard and the archive is open. The ceiling gun is already live. Shoot both dock relays and that gun, then hold E at the berth to extract. Vitals at zero loses the session.
3. Cinder Vector. WASD flies the skiff. Three lane guns cover the run to the blue storm gate. Reaching the gate wins the game immediately. Hull zero loses the session. This is the ending.

Future missions on the safehouse board stay locked until the campaign reaches them. After Cinder Vector, Deploy plays the campaign again from Ghost Signal.

## What the player can do

- Move with WASD. Shift sprints on foot. Movement is world-axis: W decreases Z, S increases Z, A decreases X, D increases X.
- On Cinder Vector, WASD flies the skiff and sprint is not a separate gear.
- Press Q to scan the overlook.
- Hold E to insert, breach, secure the seed, and extract.
- Press F to fire the pulse carbine. Shots that hit guards, the ceiling gun, relays, and lane guns damage them.
- Esc pauses. Tab or I opens the dossier.

The dock is a closed room. Crates, the safehouse rack, and the archive door block movement until the door is breached. Enemies shoot when they have a clear line. Standing in the open under a live gun is a way to lose.

## Tone references

Mad Max, Watch Dogs, and Assassin's Creed informed the recovery fiction, the hack-then-exfil cadence, and the readable stealth-to-combat turn. They are references for tone only. They do not add missions, parkour verbs, city districts, camera hacking, or a second game that still needs to be built.

## Safehouse

The safehouse is the staging board, not a separate chapter. It shows the goal, the win, the loss, the next mission, and the operator's loadout. Career notes are remembered in this browser. Review mode ignores that save and uses a fixed profile so safehouse, insertion, walkthrough, complete, and failed checks stay deterministic.
