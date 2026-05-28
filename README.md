# Space Rollr — Trønder-IT (Pygame)

## Installasjon på Raspberry Pi

```bash
sudo apt update
sudo apt install python3-pygame -y
```

## Kjør spillet

```bash
cd spacerollr-office
python3 game.py
```

## Kontroller

| Tastatur | PS4/PS5 | Handling |
|---|---|---|
| ←→ / AD | L-stick | Beveg |
| SPACE / ↑ | X | Hopp |
| Enter | Options | Velg / Start spill |
| Escape | ○ | Tilbake |
| ↑↓ | D-pad | Naviger meny |

## Filer

- `game.py` — Hovedspillet
- `levels_data.py` — Banedata (11 913 rader)
- `scores.json` — Highscores (lages automatisk)
- `skin.dat` — Lagret skin (lages automatisk)
