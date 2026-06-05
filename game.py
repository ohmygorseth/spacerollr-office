import pygame
import sys
import math
import random
import json
import os
import time

# ── Config ─────────────────────────────────────────────────────────────────
W, H         = 1120, 800
HORIZON_Y    = 296
FOCAL        = 1.0
COLS         = 5
TRACK_HW     = 2.5
VIEW_DIST    = 32
PLAYER_Z     = 1.5
BALL_RADIUS  = 25
JUMP_VY      = -260
GRAVITY      = 680
BASE_SPEED   = 5
MAX_SPEED    = 11
SPEED_GROWTH = 0.0756
LATERAL_SPEED= 3.2
LATERAL_DRAG = 9.0
FPS          = 60

SAVE_FILE    = os.path.join(os.path.dirname(__file__), 'scores.json')

OFFICE_NAMES = [
    'Vegar','Lars','Kristian E','Kristian B','Simeon',
    'Ida','Felix','Daniel','Eyerusalem','Tora',
    'Ragnar K','Einar','Kjetil','Annet'
]

NEON = [
    (255,  0, 255),
    (  0, 255, 255),
    (170,  0, 255),
    (255,  0, 153),
]

# ── Levels ─────────────────────────────────────────────────────────────────
from levels_data import LEVELS

# ── Highscore helpers ──────────────────────────────────────────────────────
def load_hs():
    try:
        with open(SAVE_FILE) as f:
            return json.load(f)
    except:
        return []

def save_hs(hs):
    with open(SAVE_FILE, 'w') as f:
        json.dump(hs, f)

def add_hs(name, score):
    hs = load_hs()
    hs.append({'name': name[:14], 'score': score})
    hs.sort(key=lambda x: -x['score'])
    hs = hs[:20]
    save_hs(hs)
    submit_world_score(name, score)  # Also push to global leaderboard

def is_highscore(score):
    hs = load_hs()
    return len(hs) < 20 or score > hs[-1]['score']

# ── Firebase World Leaderboard ─────────────────────────────────────────────
import threading
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

FIREBASE_URL = "https://space-rollr-default-rtdb.europe-west1.firebasedatabase.app"
_world_cache = []

def fetch_world_scores():
    """Fetch top scores from Firebase (runs in background thread)."""
    global _world_cache
    if not HAS_REQUESTS:
        return
    try:
        r = requests.get(FIREBASE_URL + "/scores.json", timeout=5)
        data = r.json()
        if data:
            scores = list(data.values())
            scores.sort(key=lambda x: -x.get('score', 0))
            _world_cache = scores[:100]
    except Exception:
        pass

def submit_world_score(name, score):
    """Push a score to Firebase (runs in background thread)."""
    if not HAS_REQUESTS:
        return
    def _push():
        try:
            requests.post(FIREBASE_URL + "/scores.json",
                json={'name': name[:14], 'score': score, 'ts': int(time.time()*1000)},
                timeout=5)
            fetch_world_scores()
        except Exception:
            pass
    threading.Thread(target=_push, daemon=True).start()

def start_world_refresh():
    """Background thread that refreshes world scores periodically."""
    def _loop():
        while True:
            fetch_world_scores()
            time.sleep(15)
    threading.Thread(target=_loop, daemon=True).start()

def get_world_scores():
    return _world_cache

# ── Skin builder ───────────────────────────────────────────────────────────
SKINS = [
    {'name': 'Standard', 'type': 'radial',   'c1': (170,245,240), 'c2': (0,200,192),  'c3': (0,111,106)},
    {'name': 'Rød',      'type': 'radial',   'c1': (255,170,170), 'c2': (255,32,32),   'c3': (139,0,0)},
    {'name': 'Gull',     'type': 'radial',   'c1': (255,243,170), 'c2': (255,215,0),   'c3': (184,134,11)},
    {'name': 'Grønn',    'type': 'radial',   'c1': (170,255,221), 'c2': (0,221,68),    'c3': (0,102,34)},
    {'name': 'Lilla',    'type': 'radial',   'c1': (221,170,255), 'c2': (170,0,255),   'c3': (85,0,136)},
    {'name': 'Oransje',  'type': 'radial',   'c1': (255,221,170), 'c2': (255,136,0),   'c3': (136,68,0)},
    {'name': 'Rosa',     'type': 'radial',   'c1': (255,170,221), 'c2': (255,0,170),   'c3': (136,0,85)},
    {'name': 'Is',       'type': 'radial',   'c1': (255,255,255), 'c2': (170,221,255), 'c3': (68,136,204)},
    {'name': 'Fotball',  'type': 'football'},
    {'name': 'Stripete', 'type': 'stripes',  'c1': (255,0,255),   'c2': (0,255,255)},
    {'name': 'Prikker',  'type': 'dots',     'c1': (255,102,0),   'c2': (255,255,0)},
    {'name': 'Galakse',  'type': 'galaxy'},
]

def build_skin(skin, size=64):
    surf = pygame.Surface((size, size), pygame.SRCALPHA)
    cx, cy, r = size//2, size//2, size//2 - 2

    if skin['type'] == 'radial':
        # Gradient from c1 (bright center) to c3 (dark edge)
        for rad in range(r, 0, -1):
            t = rad / r
            col = tuple(min(255, int(skin['c1'][i]*t + skin['c3'][i]*(1-t))) for i in range(3))
            pygame.draw.circle(surf, col, (cx, cy), rad)
        # Bright specular highlight
        pygame.draw.circle(surf, (255,255,255), (cx - int(r*.28), cy - int(r*.32)), int(r*.18))
        pygame.draw.circle(surf, skin['c1'], (cx - int(r*.28), cy - int(r*.32)), int(r*.12))

    elif skin['type'] == 'football':
        pygame.draw.circle(surf, (240,240,240), (cx,cy), r)
        pts = [(0,-1),(0.95,-0.31),(0.59,0.81),(-0.59,0.81),(-0.95,-0.31)]
        for i in range(len(pts)):
            a, b = pts[i], pts[(i+1)%len(pts)]
            pygame.draw.line(surf, (30,30,30),
                (int(cx+a[0]*r*.6), int(cy+a[1]*r*.6)),
                (cx, cy), 2)
        pent = [(int(cx+p[0]*r*.6), int(cy+p[1]*r*.6)) for p in pts]
        pygame.draw.polygon(surf, (30,30,30), pent, 2)
        pygame.draw.circle(surf, (80,80,80), (cx,cy), r, 2)

    elif skin['type'] == 'stripes':
        stripe_w = 8
        for i in range(0, size, stripe_w):
            col = skin['c1'] if (i//stripe_w)%2==0 else skin['c2']
            pygame.draw.rect(surf, (*col,255), (i,0,stripe_w,size))
        # Clip to circle
        mask = pygame.Surface((size,size), pygame.SRCALPHA)
        pygame.draw.circle(mask, (255,255,255,255), (cx,cy), r)
        surf.blit(mask, (0,0), special_flags=pygame.BLEND_RGBA_MIN)

    elif skin['type'] == 'dots':
        pygame.draw.circle(surf, (*skin['c1'],255), (cx,cy), r)
        step = 14
        for dx in range(-r, r, step):
            for dy in range(-r, r, step):
                px2, py2 = cx+dx+7, cy+dy+7
                if math.sqrt((px2-cx)**2+(py2-cy)**2) < r:
                    pygame.draw.circle(surf, (*skin['c2'],255), (px2,py2), 4)

    elif skin['type'] == 'galaxy':
        for y in range(size):
            for x in range(size):
                dx, dy = x-cx, y-cy
                dist = math.sqrt(dx*dx+dy*dy)
                if dist <= r:
                    t = dist/r
                    col = (int(136*(1-t)), 0, int(255*(1-t)+10*t))
                    surf.set_at((x,y), (*col,255))
        for _ in range(30):
            a = random.random()*math.pi*2
            d = random.random()*r
            sx2 = int(cx + math.cos(a)*d)
            sy2 = int(cy + math.sin(a)*d)
            v = random.randint(150,255)
            sz = random.randint(1,3)
            pygame.draw.circle(surf, (v,v,v,200), (sx2,sy2), sz)

    elif skin['type'] == 'image':
        try:
            path = os.path.join(os.path.dirname(__file__), skin['file'])
            loaded = pygame.image.load(path).convert_alpha()
            loaded = pygame.transform.smoothscale(loaded, (size, size))
            surf.blit(loaded, (0,0))
        except Exception as e:
            pygame.draw.circle(surf, (100,100,100,255), (cx,cy), r)

    # Clip all to circle
    clip = pygame.Surface((size,size), pygame.SRCALPHA)
    pygame.draw.circle(clip, (255,255,255,255), (cx,cy), r)
    result = pygame.Surface((size,size), pygame.SRCALPHA)
    result.blit(surf, (0,0))
    result.blit(clip, (0,0), special_flags=pygame.BLEND_RGBA_MIN)
    return result


def build_texture(skin, tw=96, th=48):
    """Build a flat (equirectangular) texture for sphere-mapping."""
    tex = pygame.Surface((tw, th))
    if skin['type'] == 'radial':
        tex.fill(skin['c2'])
    elif skin['type'] == 'football':
        tex.fill((240,240,240))
        # Pentagon spots in a grid
        for gx in range(0, tw, 24):
            for gy in range(0, th, 24):
                off = 12 if (gy//24)%2 else 0
                pygame.draw.circle(tex, (30,30,30), (gx+off, gy+12), 7)
    elif skin['type'] == 'stripes':
        for x in range(tw):
            col = skin['c1'] if (x//8)%2==0 else skin['c2']
            pygame.draw.line(tex, col, (x,0), (x,th))
    elif skin['type'] == 'dots':
        tex.fill(skin['c1'])
        for gx in range(0, tw, 14):
            for gy in range(0, th, 14):
                off = 7 if (gy//14)%2 else 0
                pygame.draw.circle(tex, skin['c2'], (gx+off, gy+7), 4)
    elif skin['type'] == 'galaxy':
        tex.fill((20,0,50))
        for _ in range(60):
            x = random.randint(0,tw-1); y = random.randint(0,th-1)
            v = random.randint(150,255)
            tex.set_at((x,y), (v,v,v))
    elif skin['type'] == 'image':
        try:
            path = os.path.join(os.path.dirname(__file__), skin['file'])
            loaded = pygame.image.load(path).convert()
            tex = pygame.transform.smoothscale(loaded, (tw, th))
        except:
            tex.fill((100,100,100))
    return tex


def sphere_frames(skin, size=64, n_frames=16):
    """Pre-render n_frames of a rolling sphere (rolls forward)."""
    tex = build_texture(skin)
    tw, th = tex.get_size()
    tex.lock()
    r = size//2 - 2
    cx = cy = size//2
    frames = []
    for f in range(n_frames):
        roll = (f / n_frames) * 2 * math.pi  # forward roll offset
        surf = pygame.Surface((size, size), pygame.SRCALPHA)
        surf.lock()
        for py in range(size):
            for px in range(size):
                dx = px - cx
                dy = py - cy
                d2 = dx*dx + dy*dy
                if d2 > r*r:
                    continue
                nz = math.sqrt(max(0, r*r - d2))
                # 3D point on sphere surface (normalized)
                nx = dx / r
                ny = dy / r
                nzn = nz / r
                # Roll forward = rotate around X axis by roll
                ry = ny*math.cos(roll) - nzn*math.sin(roll)
                rz = ny*math.sin(roll) + nzn*math.cos(roll)
                # Map to lat/long
                lon = math.atan2(nx, rz)
                lat = math.asin(max(-1,min(1,ry)))
                u = int((lon/(2*math.pi) + 0.5) * tw) % tw
                v = int((lat/math.pi + 0.5) * th) % th
                col = tex.get_at((u, v))
                # Simple shading by depth
                shade = 0.55 + 0.45 * nzn
                surf.set_at((px,py), (int(col[0]*shade), int(col[1]*shade), int(col[2]*shade), 255))
        surf.unlock()
        frames.append(surf)
    tex.unlock()
    return frames

# ── Projection ─────────────────────────────────────────────────────────────
def pr(d):
    d = max(d, 0.05)
    s = FOCAL / d
    return {
        'y': HORIZON_Y + (H - HORIZON_Y) * s,
        'hw': W * 0.46 * s,
        's': s,
    }

# ── Track helpers ──────────────────────────────────────────────────────────
def mk_row(z, level_data):
    i = int(z)
    lvl = level_data
    idx = i % len(lvl)
    return list(lvl[idx])

def get_row(wz, track, t_base):
    i = int(wz) - t_base
    if 0 <= i < len(track):
        return track[i]
    return None

def grow_track(cam_z, track, t_base, level_data):
    need = int(cam_z) + VIEW_DIST + 6
    while t_base + len(track) <= need:
        track.append(mk_row(t_base + len(track), level_data))
    while t_base < int(cam_z) - 4 and track:
        track.pop(0)
        t_base += 1
    return track, t_base

# ── Text helpers ───────────────────────────────────────────────────────────
def draw_text(surf, font, text, x, y, color, center=False):
    img = font.render(text, True, color)
    if center:
        x -= img.get_width()//2
    surf.blit(img, (x, y))

def draw_panel(surf, x, y, w, h, color):
    s = pygame.Surface((w, h), pygame.SRCALPHA)
    s.fill((0,0,0,180))
    pygame.draw.rect(s, (*color,200), (0,0,w,h), 2)
    surf.blit(s, (x, y))

def draw_neon_btn(surf, x, y, w, h, text, color, font, highlight=False):
    s = pygame.Surface((w,h), pygame.SRCALPHA)
    bg = (color[0]//6, color[1]//6, color[2]//6, 200) if not highlight else (color[0]//3, color[1]//3, color[2]//3, 220)
    s.fill(bg)
    pygame.draw.rect(s, (*color,220), (0,0,w,h), 2)
    surf.blit(s, (x,y))
    img = font.render(text, True, color if not highlight else (255,255,255))
    surf.blit(img, (x + w//2 - img.get_width()//2, y + h//2 - img.get_height()//2))

# ── Stars ──────────────────────────────────────────────────────────────────
def make_stars(n=120):
    stars = []
    for _ in range(n):
        stars.append({
            'x': random.random()*W,
            'y': random.random()*H,
            'size': random.randint(1,2),
            'col': random.choice([(255,255,255),(200,220,255),(220,200,255),(255,240,200)]),
            'drift': 8 + random.random()*20,  # slow downward drift speed (px/s)
        })
    return stars

# ── Main Game Class ─────────────────────────────────────────────────────────
class SpaceRollr:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption("Space Rollr — Trønder-IT")
        self.screen = pygame.display.set_mode((W, H))
        self.fullscreen = False
        self.clock = pygame.time.Clock()

        # Fonts
        self.font_lg  = pygame.font.SysFont('monospace', 34, bold=True)
        self.font_md  = pygame.font.SysFont('monospace', 18, bold=True)
        self.font_sm  = pygame.font.SysFont('monospace', 13)
        self.font_xs  = pygame.font.SysFont('monospace', 11)
        self.font_title = pygame.font.SysFont('monospace', 64, bold=True)

        # Build skin surfaces
        pygame.display.flip()  # show window before slow skin build
        # Show loading screen while building skins
        loading = pygame.font.SysFont('monospace', 24, bold=True)
        self.screen.fill((0,0,15))
        img = loading.render('Laster...', True, (0,200,192))
        self.screen.blit(img, (W//2 - img.get_width()//2, H//2))
        pygame.display.flip()
        self.skin_surfs = [build_skin(s, 64) for s in SKINS]
        # Pre-render rolling sphere frames for the ball (scaled to ball size)
        self.skin_frames = []
        n_skins = len(SKINS)
        self.screen.fill((0,0,15))
        msg = loading.render('Loading...', True, (0,200,192))
        self.screen.blit(msg, (W//2 - msg.get_width()//2, H//2))
        pygame.display.flip()
        for si, s in enumerate(SKINS):
            frames = sphere_frames(s, size=BALL_RADIUS*2, n_frames=16)
            self.skin_frames.append(frames)
        self.selected_skin = self._load_skin()
        start_world_refresh()  # Begin fetching world leaderboard
        self._scaled_skin = None
        self._scaled_skin_idx = -1

        # Stars
        self.stars = make_stars(180)
        self.star_offset = 0.0

        # Build static background
        self.bg_surf = self._make_bg()

        # Joystick
        pygame.joystick.init()
        self.joysticks = []
        self._init_joysticks()

        # State
        self.state = 'start'       # start, play, dead, enter_name
        self.menu_state = 'main'   # main, skinselect
        self.reset()

        # Menu
        self.main_menu_idx = 0     # 0=play, 1=skins
        self.skin_menu_idx = self.selected_skin
        self.hs_scroll = 0
        self.world_scroll = 0

        # Name entry
        self.name_picker_idx = 0
        self.typing_custom = False
        self.name_input = ''
        self.gp_letter_idx = 0

        # Input timing
        self.gp_last_dir = 0
        self.gp_last_press = 0

        # Score
        self.score = 0
        self.hi = 0
        self.score_offset = 0
        self.loop_count = 0
        self.speed_notif = 0
        self.last_speed_level = 0

    # ── Init helpers ─────────────────────────────────────────────────────
    def _init_joysticks(self):
        self.joysticks = []
        for i in range(pygame.joystick.get_count()):
            j = pygame.joystick.Joystick(i)
            j.init()
            self.joysticks.append(j)

    def _load_skin(self):
        try:
            with open(os.path.join(os.path.dirname(__file__), 'skin.dat')) as f:
                idx = int(f.read().strip())
                if 0 <= idx < len(SKINS):
                    return idx
                return 0
        except:
            return 0

    def _save_skin(self, idx):
        with open(os.path.join(os.path.dirname(__file__), 'skin.dat'), 'w') as f:
            f.write(str(idx))

    def _make_bg(self):
        surf = pygame.Surface((W, H))
        # Deep space gradient - very dark
        for y in range(H):
            t = y / H
            r = int(0 + 5*t)
            g = 0
            b = int(10 + 20*t)
            pygame.draw.line(surf, (r,g,b), (0,y), (W,y))
        # Subtle nebula
        nb = pygame.Surface((W,H), pygame.SRCALPHA)
        pygame.draw.circle(nb, (40,0,80,25), (int(W*0.3), int(H*0.3)), 280)
        pygame.draw.circle(nb, (0,20,80,20), (int(W*0.75), int(H*0.2)), 220)
        surf.blit(nb, (0,0))
        return surf

    # ── Reset ────────────────────────────────────────────────────────────
    def reset(self):
        self.cam_z = 0.0
        # Don't reset star_offset - keeps starfield continuous
        self.px = 0.0
        self.pvx = 0.0
        self.jy = 0.0
        self.jvy = 0.0
        self.spd = float(BASE_SPEED)
        self.score = 0
        self.pts = []
        self.rot = 0.0
        self.track = []
        self.t_base = 0
        self.level_data = LEVELS[0]
        self.track, self.t_base = grow_track(0, self.track, self.t_base, self.level_data)

    # ── Gamepad reading ───────────────────────────────────────────────────
    def read_gp(self):
        if not self.joysticks:
            return {}
        j = self.joysticks[0]
        axes = [j.get_axis(i) for i in range(j.get_numaxes())]
        btns = [j.get_button(i) for i in range(j.get_numbuttons())]
        hats = [j.get_hat(i) for i in range(j.get_numhats())]

        def ax(i): return axes[i] if i < len(axes) else 0
        def btn(i): return bool(btns[i]) if i < len(btns) else False
        def hat_x(): return hats[0][0] if hats else 0
        def hat_y(): return hats[0][1] if hats else 0

        return {
            'left':   ax(0) < -0.3 or hat_x() < 0,
            'right':  ax(0) >  0.3 or hat_x() > 0,
            'up':     ax(1) < -0.3 or hat_y() > 0,
            'down':   ax(1) >  0.3 or hat_y() < 0,
            'jump':   btn(0),            # X / Cross
            'circle': btn(1),            # Circle
            'options':btn(9),  # Options/Start
            'l1':     btn(4),
            'r1':     btn(5),
            'l2':     btn(6) or (ax(4) > 0.3 if len(axes) > 4 else False),
            'r2':     btn(7) or (ax(5) > 0.3 if len(axes) > 5 else False),
            'ax0':    ax(0),
            'ax1':    ax(1),
        }

    # ── Die ───────────────────────────────────────────────────────────────
    def die(self):
        if self.score > self.hi:
            self.hi = self.score
        if is_highscore(self.score):
            self.state = 'enter_name'
            self.name_input = ''
            self.name_picker_idx = 0
            self.typing_custom = False
        else:
            self.state = 'dead'

    # ── Spawn spark ───────────────────────────────────────────────────────
    def spawn_spark(self):
        p_info = pr(PLAYER_Z)
        bx = W/2 + (self.px / TRACK_HW) * p_info['hw']
        for _ in range(3):
            self.pts.append({
                'x': bx, 'y': p_info['y'],
                'vx': (random.random()-.5)*100,
                'vy': -50-random.random()*60,
                'life': 0.35,
                'col': random.choice([(255,0,255),(0,255,255),(170,0,255)])
            })

    # ── Update ───────────────────────────────────────────────────────────
    def update(self, dt, keys, gp):
        if self.state != 'play':
            return

        self.cam_z += self.spd * dt
        total_tiles = self.score_offset + int(self.cam_z)
        self.score = total_tiles * 12

        tiles_after = max(0, total_tiles - 1827)
        base_spd = min(MAX_SPEED, BASE_SPEED + total_tiles * SPEED_GROWTH)
        self.spd = min(25, base_spd + int(tiles_after/5))

        cur_level = int(self.spd)
        if cur_level > self.last_speed_level:
            self.last_speed_level = cur_level
            self.speed_notif = 3.0
        if self.speed_notif > 0:
            self.speed_notif -= dt

        # Movement
        left  = keys[pygame.K_LEFT]  or keys[pygame.K_a] or gp.get('left')
        right = keys[pygame.K_RIGHT] or keys[pygame.K_d] or gp.get('right')
        jump  = keys[pygame.K_SPACE] or keys[pygame.K_UP] or gp.get('jump')

        target_vx = LATERAL_SPEED if right else (-LATERAL_SPEED if left else 0)
        self.pvx += (target_vx - self.pvx) * LATERAL_DRAG * dt
        self.px = max(-TRACK_HW+.12, min(TRACK_HW-.12, self.px + self.pvx * dt))
        self.rot += self.spd * dt * (1/BALL_RADIUS) * 8 + self.pvx * 3 * dt

        if jump and self.jy >= 0:
            self.jvy = JUMP_VY
            self.jy = -1

        self.jvy += GRAVITY * dt
        self.jy += self.jvy * dt
        if self.jy > 0:
            self.jy = 0
            self.jvy = 0

        # Collision
        row = get_row(self.cam_z + PLAYER_Z, self.track, self.t_base)
        ball_w = 0.15
        col_l = max(0, min(COLS-1, int(self.px + TRACK_HW - ball_w)))
        col_r = max(0, min(COLS-1, int(self.px + TRACK_HW + ball_w)))
        solid = row and (row[col_l] or row[col_r])

        if self.jy >= 0 and not solid:
            self.die()
            return

        if solid and self.jy >= 0 and abs(self.pvx) > 1.5 and random.random() < .15:
            self.spawn_spark()

        # Particles
        for p in self.pts:
            p['x'] += p['vx'] * dt
            p['y'] += p['vy'] * dt
            p['vy'] += 300 * dt
            p['life'] -= dt
        self.pts = [p for p in self.pts if p['life'] > 0]

        # Grow track + loop
        self.track, self.t_base = grow_track(self.cam_z, self.track, self.t_base, self.level_data)
        if self.cam_z + PLAYER_Z >= len(self.level_data):
            self.score_offset += int(self.cam_z)
            self.cam_z = 0
            self.jy = 0
            self.jvy = 0
            self.pts = []
            self.track = []
            self.t_base = 0
            self.loop_count += 1
            self.track, self.t_base = grow_track(0, self.track, self.t_base, self.level_data)

    # ── Draw background ───────────────────────────────────────────────────
    def update_stars(self, dt):
        for s in self.stars:
            s['y'] += s['drift'] * dt
            if s['y'] > H:
                s['y'] = 0
                s['x'] = random.random()*W

    def draw_bg(self):
        self.screen.blit(self.bg_surf, (0,0))
        for s in self.stars:
            pygame.draw.rect(self.screen, s['col'],
                (int(s['x']), int(s['y']), s['size'], s['size']))

    # ── Draw track ────────────────────────────────────────────────────────
    def draw_track(self):
        for i in range(VIEW_DIST, -1, -1):
            wz = int(self.cam_z) + i
            df = wz - self.cam_z
            db = wz + 1 - self.cam_z
            if df < 0.08:
                continue
            pF = pr(df)
            pB = pr(db)
            if pB['y'] > H+12 or pF['y'] < HORIZON_Y - 4:
                continue
            row = get_row(wz, self.track, self.t_base)
            if not row:
                continue

            twF = pF['hw'] * 2 / COLS
            twB = pB['hw'] * 2 / COLS
            yF, yB = int(pF['y']), int(pB['y'])
            neon_idx = (int(wz/6)) % len(NEON)
            base_col = NEON[neon_idx]
            tint = tuple(c//4 for c in base_col)

            # Draw each tile individually with full outline
            for c in range(COLS):
                if not row[c]:
                    continue
                x1f = int(W/2 - pF['hw'] + c * twF)
                x2f = int(W/2 - pF['hw'] + (c+1) * twF)
                x1b = int(W/2 - pB['hw'] + c * twB)
                x2b = int(W/2 - pB['hw'] + (c+1) * twB)
                pts_poly = [(x1f,yF),(x2f,yF),(x2b,yB),(x1b,yB)]
                pygame.draw.polygon(self.screen, (10, 0, 30), pts_poly)
                pygame.draw.polygon(self.screen, tint, pts_poly)
                pygame.draw.polygon(self.screen, base_col, pts_poly, 1)

    # ── Draw ball ─────────────────────────────────────────────────────────
    def draw_ball(self):
        p_info = pr(PLAYER_Z)
        bx = int(W/2 + (self.px / TRACK_HW) * p_info['hw'])
        gY = int(p_info['y'] - BALL_RADIUS)
        by = int(gY + self.jy)

        # Shadow ellipse
        pygame.draw.ellipse(self.screen, (0,0,0),
            (bx - BALL_RADIUS, gY - BALL_RADIUS//4, BALL_RADIUS*2, BALL_RADIUS//2))

        # Pick rolling frame based on distance traveled
        frames = self.skin_frames[self.selected_skin]
        n = len(frames)
        frame_idx = int((self.rot / (2*math.pi)) * n) % n
        ball_img = frames[frame_idx]
        self.screen.blit(ball_img, (bx - BALL_RADIUS, by - BALL_RADIUS))

    # ── Draw particles ────────────────────────────────────────────────────
    def draw_particles(self):
        pass  # Particles removed

    # ── Draw HUD ──────────────────────────────────────────────────────────
    def draw_hud(self):
        # Score
        draw_text(self.screen, self.font_lg, f'SCORE {self.score}', 10, 10, (255,255,255))

        # Speed bar
        bar_w, bar_h, bar_x, bar_y = 280, 14, 10, 54
        speed_pct = min(1.0, (self.spd - BASE_SPEED) / (MAX_SPEED*2 - BASE_SPEED))
        pygame.draw.rect(self.screen, (255,255,255,30), (bar_x, bar_y, bar_w, bar_h))
        if speed_pct > 0:
            grad_surf = pygame.Surface((int(bar_w*speed_pct), bar_h))
            for x in range(int(bar_w*speed_pct)):
                t = x / bar_w
                r = int(0*(1-t) + 255*t)
                g = int(255*(1-t) + 0*t)
                b = int(255*(1-t) + 102*t)
                pygame.draw.line(grad_surf, (r,g,b), (x,0), (x,bar_h))
            self.screen.blit(grad_surf, (bar_x, bar_y))
        draw_text(self.screen, self.font_sm, f'SPD {self.spd:.1f}', bar_x, bar_y - 16, (255,255,255,153))

        # Speed notif
        if self.speed_notif > 0:
            draw_text(self.screen, self.font_md, f'SPEED UP! {int(self.spd)}x', W//2, 30,
                (255,200,0), center=True)

    # ── Draw highscore panel ──────────────────────────────────────────────
    def _draw_one_panel(self, scores, x, y, pw, title, color, scroll):
        row_h = 30
        visible = 10
        ph = visible * row_h + 28
        px2 = x - pw//2
        scroll = max(0, min(scroll, max(0, len(scores)-visible)))

        draw_panel(self.screen, px2, y, pw, ph, color)
        t_img = self.font_md.render(title, True, color)
        self.screen.blit(t_img, (x - t_img.get_width()//2, y+6))

        if not scores:
            msg = self.font_sm.render('Ingen scores ennå', True, (160,160,160))
            self.screen.blit(msg, (x - msg.get_width()//2, y+50))
        else:
            for i, entry in enumerate(scores[scroll:scroll+visible]):
                idx = scroll + i
                ey = y + 36 + i * row_h
                if idx == 0:   col = (255,215,0)
                elif idx == 1: col = (192,192,192)
                elif idx == 2: col = (205,127,50)
                else:          col = (165,165,165)
                bold = idx < 3
                f = pygame.font.SysFont('monospace', 13, bold=bold)
                rank_img = f.render(f'{idx+1:2}.', True, col)
                name_img = f.render(str(entry.get('name',''))[:12], True, col)
                score_img = f.render(str(entry.get('score',0)), True, col)
                self.screen.blit(rank_img, (px2+8, ey))
                self.screen.blit(name_img, (px2+30, ey))
                self.screen.blit(score_img, (px2+pw-8-score_img.get_width(), ey))
            if len(scores) > visible:
                track_h = ph - 26
                thumb_h = max(20, int((visible/len(scores))*track_h))
                thumb_y = y+22 + int((scroll/max(1,len(scores)-visible))*(track_h-thumb_h))
                dark = tuple(c//3 for c in color)
                pygame.draw.rect(self.screen, dark, (px2+pw-6, y+22, 4, track_h))
                pygame.draw.rect(self.screen, color, (px2+pw-6, thumb_y, 4, thumb_h))
        return scroll

    def draw_hs_panel(self, x, y):
        hs = load_hs()
        world = get_world_scores()
        pw = 300
        gap = 20
        lx = x - pw//2 - gap//2
        rx = x + pw//2 + gap//2
        self.hs_scroll = self._draw_one_panel(hs, lx, y, pw, 'TRØNDER-IT', (255,0,255), self.hs_scroll)
        self._draw_one_panel(world, rx, y, pw, 'WORLD TOP 100', (170,0,255), self.world_scroll)

    # ── Draw logo ─────────────────────────────────────────────────────────
    def draw_logo(self, cx2, y):
        text = 'SPACE  ROLLR'
        half = len(text)//2
        for i, ch in enumerate(text):
            t = i / len(text)
            r = int(255*(1-t) + 0*t)
            g = int(0)
            b = int(255*t + 255*(1-t))
            col = (r, 0, b)
            img = self.font_title.render(ch, True, col)
            x_off = cx2 - self.font_title.size(text)[0]//2 + self.font_title.size(text[:i])[0]
            self.screen.blit(img, (x_off, y))

    # ── Draw start screen ─────────────────────────────────────────────────
    def draw_start_screen(self):
        self.draw_bg()
        cx2 = W//2
        self.draw_logo(cx2, int(H*0.08))

        # Controls hint
        draw_text(self.screen, self.font_sm, '←→  MOVE   |   SPACE = JUMP', cx2, int(H*0.22), (180,180,180), center=True)
        draw_text(self.screen, self.font_sm, 'L-STICK MOVE   |   X = JUMP', cx2, int(H*0.22)+18, (180,180,180), center=True)

        py2 = int(H*0.28) + 20
        # Play button
        draw_neon_btn(self.screen, cx2-110, py2, 220, 56, 'PLAY GAME',
            (0,255,255), self.font_md, highlight=self.main_menu_idx==0)
        # Skin button
        draw_neon_btn(self.screen, cx2-110, py2+68, 220, 36, 'VELG SKIN',
            (170,0,255), self.font_sm, highlight=self.main_menu_idx==1)

        # Highscore
        self.draw_hs_panel(cx2, py2+118)

    # ── Draw skin select ──────────────────────────────────────────────────
    def draw_skin_select(self):
        self.draw_bg()
        cx2 = W//2
        self.draw_logo(cx2, int(H*0.04))
        draw_text(self.screen, self.font_md, 'VELG SKIN', cx2, int(H*0.2), (170,0,255), center=True)

        cols = 4
        cell_w, cell_h = 240, 110
        grid_w = cols * cell_w
        gx = cx2 - grid_w//2
        gy = int(H*0.27)

        for i, skin in enumerate(SKINS):
            col = i % cols
            row = i // cols
            bx = gx + col*cell_w + 10
            by = gy + row*cell_h + 6
            selected = i == self.skin_menu_idx
            active   = i == self.selected_skin

            bg_col = (60,0,60,100) if selected else ((0,40,40,60) if active else (20,20,20,60))
            s = pygame.Surface((cell_w-20, cell_h-12), pygame.SRCALPHA)
            s.fill(bg_col)
            self.screen.blit(s, (bx, by))
            border = (255,0,255) if selected else ((0,255,255) if active else (60,60,60))
            pygame.draw.rect(self.screen, border, (bx, by, cell_w-20, cell_h-12), 2 if selected else 1)

            # Mini ball
            ball_x = bx + 30
            ball_y = by + (cell_h-12)//2
            mini = pygame.transform.scale(self.skin_surfs[i], (44,44))
            self.screen.blit(mini, (ball_x-22, ball_y-22))

            if active:
                draw_text(self.screen, self.font_xs, '✓', bx+4, by+4, (0,255,255))

            name_col = (255,255,255) if selected else (180,180,180)
            f = pygame.font.SysFont('monospace', 13, bold=selected)
            name_img = f.render(skin['name'], True, name_col)
            self.screen.blit(name_img, (bx+58, ball_y-name_img.get_height()//2))

        draw_text(self.screen, self.font_xs,
            '↑↓←→ / D-PAD = bla   |   X / OPTIONS = velg   |   ○ = tilbake',
            cx2, int(H*0.88), (180,180,180), center=True)
        draw_neon_btn(self.screen, cx2-50, int(H*0.91), 100, 30, 'BACK',
            (150,150,150), self.font_sm)

    # ── Draw game over ────────────────────────────────────────────────────
    def draw_dead(self):
        s = pygame.Surface((W,H), pygame.SRCALPHA)
        s.fill((0,0,0,140))
        self.screen.blit(s, (0,0))
        draw_text(self.screen, self.font_title, 'GAME OVER', W//2, H//2-80, (255,0,80), center=True)
        draw_text(self.screen, self.font_md, f'Score: {self.score}', W//2, H//2, (255,255,255), center=True)
        draw_text(self.screen, self.font_sm, 'OPTIONS / ENTER = spill igjen', W//2, H//2+40, (150,150,150), center=True)

    # ── Draw name picker ──────────────────────────────────────────────────
    def draw_enter_name(self):
        self.draw_bg()
        cx2 = W//2
        self.draw_logo(cx2, int(H*0.08))

        hs = load_hs()
        place = sum(1 for e in hs if e['score'] > self.score) + 1
        medals = {1:'1. PLASS!', 2:'2. PLASS!', 3:'3. PLASS!'}
        place_str = medals.get(place, f'{place}. PLASS!')
        draw_text(self.screen, self.font_md, place_str, cx2, int(H*0.28), (255,215,0), center=True)
        draw_text(self.screen, self.font_sm, f'Score: {self.score}', cx2, int(H*0.28)+28, (200,200,200), center=True)

        if self.typing_custom:
            pw, ph = 300, 120
            px2 = cx2 - pw//2
            py2 = int(H*0.38)
            draw_panel(self.screen, px2, py2, pw, ph, (0,255,255))
            draw_text(self.screen, self.font_sm, 'SKRIV INN NAVN:', cx2, py2+12, (0,255,255), center=True)
            pygame.draw.rect(self.screen, (255,255,255), (px2+20, py2+30, pw-40, 36), 0)
            name_img = self.font_md.render(self.name_input+'|', True, (0,0,0))
            self.screen.blit(name_img, (cx2 - name_img.get_width()//2, py2+38))
            draw_text(self.screen, self.font_xs, 'ENTER = lagre  |  ESC = tilbake', cx2, py2+ph-16, (150,150,150), center=True)
        else:
            vis = 7
            item_h = 36
            list_w = 300
            list_h = vis * item_h + 16
            lx = cx2 - list_w//2
            ly = int(H*0.38)
            draw_panel(self.screen, lx, ly, list_w, list_h, (255,0,255))
            draw_text(self.screen, self.font_sm, 'VELG NAVN', cx2, ly+8, (255,0,255), center=True)

            start = max(0, min(self.name_picker_idx - vis//2, len(OFFICE_NAMES)-vis))
            clip = pygame.Surface((list_w-4, list_h-18), pygame.SRCALPHA)
            for i in range(vis):
                idx = start + i
                if idx >= len(OFFICE_NAMES): break
                iy = i * item_h
                sel = idx == self.name_picker_idx
                if sel:
                    pygame.draw.rect(clip, (255,0,255,60), (0, iy-2, list_w-4, item_h-4))
                    pygame.draw.rect(clip, (255,0,255,200), (0, iy-2, list_w-4, item_h-4), 2)
                name = OFFICE_NAMES[idx]
                col = (255,255,255) if sel else ((255,200,0) if name=='Annet' else (160,160,160))
                f = pygame.font.SysFont('monospace', 14, bold=sel)
                text = f'▶ {name} ◀' if sel else name
                img = f.render(text, True, col)
                clip.blit(img, (list_w//2 - img.get_width()//2, iy + item_h//2 - img.get_height()//2))
            self.screen.blit(clip, (lx+2, ly+16))
            draw_text(self.screen, self.font_xs, '↑↓ = bla  |  OPTIONS = velg  |  ○ = avbryt',
                cx2, ly+list_h+12, (150,150,150), center=True)

    # ── Handle menu gamepad ───────────────────────────────────────────────
    def handle_menu_gp(self, gp):
        now = time.time() * 1000

        if self.state == 'enter_name':
            if self.typing_custom:
                if gp.get('circle') and now - self.gp_last_press > 300:
                    self.gp_last_press = now
                    self.typing_custom = False
                    self.name_input = ''
                if gp.get('options') and self.name_input and now - self.gp_last_press > 300:
                    self.gp_last_press = now
                    add_hs(self.name_input, self.score)
                    self.state = 'start'
                    self.menu_state = 'main'
                # Letter picker
                if gp.get('right') and now - self.gp_last_dir > 150:
                    self.gp_last_dir = now
                    self.gp_letter_idx = (self.gp_letter_idx + 1) % 26
                if gp.get('left') and now - self.gp_last_dir > 150:
                    self.gp_last_dir = now
                    self.gp_letter_idx = (self.gp_letter_idx - 1) % 26
                if gp.get('jump') and now - self.gp_last_press > 200:
                    self.gp_last_press = now
                    if len(self.name_input) < 12:
                        self.name_input += chr(65 + self.gp_letter_idx)
                if gp.get('circle') and now - self.gp_last_press > 200:
                    self.gp_last_press = now
                    self.name_input = self.name_input[:-1]
            else:
                if gp.get('down') and now - self.gp_last_dir > 150:
                    self.gp_last_dir = now
                    self.name_picker_idx = (self.name_picker_idx + 1) % len(OFFICE_NAMES)
                if gp.get('up') and now - self.gp_last_dir > 150:
                    self.gp_last_dir = now
                    self.name_picker_idx = (self.name_picker_idx - 1) % len(OFFICE_NAMES)
                if gp.get('options') and now - self.gp_last_press > 300:
                    self.gp_last_press = now
                    if OFFICE_NAMES[self.name_picker_idx] == 'Annet':
                        self.typing_custom = True
                        self.name_input = ''
                    else:
                        add_hs(OFFICE_NAMES[self.name_picker_idx], self.score)
                        self.state = 'start'
                        self.menu_state = 'main'
                if gp.get('circle') and now - self.gp_last_press > 300:
                    self.gp_last_press = now
                    self.state = 'start'
                    self.menu_state = 'main'
            return

        if self.menu_state == 'main':
            if gp.get('down') and now - self.gp_last_dir > 150:
                self.gp_last_dir = now
                self.main_menu_idx = (self.main_menu_idx + 1) % 2
            if gp.get('up') and now - self.gp_last_dir > 150:
                self.gp_last_dir = now
                self.main_menu_idx = (self.main_menu_idx - 1) % 2
            if gp.get('jump') and now - self.gp_last_press > 300:
                self.gp_last_press = now
                if self.main_menu_idx == 0:
                    self.start_game()
                else:
                    self.skin_menu_idx = self.selected_skin
                    self.menu_state = 'skinselect'
            if gp.get('options') and now - self.gp_last_press > 300:
                self.gp_last_press = now
                self.start_game()
            # HS scroll
            if gp.get('r1') and now - self.gp_last_dir > 120:
                self.gp_last_dir = now
                hs = load_hs()
                self.hs_scroll = min(self.hs_scroll+1, max(0, len(hs)-10))
            if gp.get('l1') and now - self.gp_last_dir > 120:
                self.gp_last_dir = now
                self.hs_scroll = max(0, self.hs_scroll-1)
            if gp.get('r2') and now - self.gp_last_dir > 120:
                self.gp_last_dir = now
                world = get_world_scores()
                self.world_scroll = min(self.world_scroll+1, max(0, len(world)-10))
            if gp.get('l2') and now - self.gp_last_dir > 120:
                self.gp_last_dir = now
                self.world_scroll = max(0, self.world_scroll-1)

        elif self.menu_state == 'skinselect':
            cols = 4
            if gp.get('right') and now - self.gp_last_dir > 150:
                self.gp_last_dir = now
                self.skin_menu_idx = (self.skin_menu_idx+1) % len(SKINS)
            if gp.get('left') and now - self.gp_last_dir > 150:
                self.gp_last_dir = now
                self.skin_menu_idx = (self.skin_menu_idx-1) % len(SKINS)
            if gp.get('down') and now - self.gp_last_dir > 150:
                self.gp_last_dir = now
                self.skin_menu_idx = min(len(SKINS)-1, self.skin_menu_idx+cols)
            if gp.get('up') and now - self.gp_last_dir > 150:
                self.gp_last_dir = now
                self.skin_menu_idx = max(0, self.skin_menu_idx-cols)
            if (gp.get('jump') or gp.get('options')) and now - self.gp_last_press > 300:
                self.gp_last_press = now
                self.selected_skin = self.skin_menu_idx
                self._save_skin(self.skin_menu_idx)
                self.menu_state = 'main'
            if gp.get('circle') and now - self.gp_last_press > 300:
                self.gp_last_press = now
                self.menu_state = 'main'

        if self.state == 'dead' and gp.get('circle') and now - self.gp_last_press > 300:
            self.gp_last_press = now
            self.state = 'start'
            self.menu_state = 'main'

    # ── Start game ────────────────────────────────────────────────────────
    def start_game(self):
        self.reset()
        self.state = 'play'
        self.score_offset = 0
        self.loop_count = 0
        self.speed_notif = 0
        self.last_speed_level = 0

    # ── Main loop ─────────────────────────────────────────────────────────
    def run(self):
        prev_time = time.time()

        while True:
            now_time = time.time()
            dt = min(now_time - prev_time, 0.05)
            prev_time = now_time

            keys = pygame.key.get_pressed()
            gp = self.read_gp()

            # ── Events ──────────────────────────────────────────────────
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    pygame.quit()
                    sys.exit()

                if hasattr(pygame, 'JOYDEVICEADDED') and event.type == pygame.JOYDEVICEADDED:
                    self._init_joysticks()

                # Mouse wheel scroll (works in pygame 1.9.6 via button 4/5)
                if event.type == pygame.MOUSEBUTTONDOWN and event.button in (4,5):
                    mx, my = event.pos
                    direction = -1 if event.button == 4 else 1
                    if mx < W//2:
                        hs = load_hs()
                        self.hs_scroll = max(0, min(self.hs_scroll + direction, max(0, len(hs)-10)))
                    else:
                        world = get_world_scores()
                        self.world_scroll = max(0, min(self.world_scroll + direction, max(0, len(world)-10)))

                if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                    mx, my = event.pos
                    if self.state == 'start' and self.menu_state == 'main':
                        py2 = int(H*0.28) + 20
                        if W//2-110 < mx < W//2+110:
                            if py2 < my < py2+56:
                                self.start_game()
                            elif py2+68 < my < py2+104:
                                self.skin_menu_idx = self.selected_skin
                                self.menu_state = 'skinselect'
                    elif self.state == 'start' and self.menu_state == 'skinselect':
                        cols = 4
                        cell_w, cell_h = 240, 110
                        gx = W//2 - cols*cell_w//2
                        gy = int(H*0.27)
                        for i in range(len(SKINS)):
                            c = i % cols
                            r2 = i // cols
                            bx = gx + c*cell_w + 10
                            by = gy + r2*cell_h + 6
                            if bx < mx < bx+cell_w-20 and by < my < by+cell_h-12:
                                self.selected_skin = i
                                self._save_skin(i)
                                self.menu_state = 'main'
                        if W//2-50 < mx < W//2+50 and int(H*0.91) < my < int(H*0.91)+30:
                            self.menu_state = 'main'

                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_F11:
                        self.fullscreen = not self.fullscreen
                        if self.fullscreen:
                            self.screen = pygame.display.set_mode((0,0), pygame.FULLSCREEN)
                        else:
                            self.screen = pygame.display.set_mode((W,H))

                    # Global escape
                    if event.key == pygame.K_ESCAPE:
                        if self.state == 'play':
                            self.state = 'start'
                            self.menu_state = 'main'
                        elif self.menu_state == 'skinselect':
                            self.menu_state = 'main'
                        elif self.state in ('dead', 'enter_name'):
                            self.state = 'start'
                            self.menu_state = 'main'

                    # Start screen
                    if self.state == 'start' and self.menu_state == 'main':
                        if event.key in (pygame.K_RETURN, pygame.K_SPACE):
                            if self.main_menu_idx == 0:
                                self.start_game()
                            else:
                                self.skin_menu_idx = self.selected_skin
                                self.menu_state = 'skinselect'
                        elif event.key == pygame.K_UP:
                            self.main_menu_idx = (self.main_menu_idx-1) % 2
                        elif event.key == pygame.K_DOWN:
                            self.main_menu_idx = (self.main_menu_idx+1) % 2

                    # Skin select keyboard
                    elif self.menu_state == 'skinselect':
                        if event.key == pygame.K_RIGHT:
                            self.skin_menu_idx = (self.skin_menu_idx+1) % len(SKINS)
                        elif event.key == pygame.K_LEFT:
                            self.skin_menu_idx = (self.skin_menu_idx-1) % len(SKINS)
                        elif event.key == pygame.K_DOWN:
                            self.skin_menu_idx = min(len(SKINS)-1, self.skin_menu_idx+4)
                        elif event.key == pygame.K_UP:
                            self.skin_menu_idx = max(0, self.skin_menu_idx-4)
                        elif event.key in (pygame.K_RETURN, pygame.K_SPACE):
                            self.selected_skin = self.skin_menu_idx
                            self._save_skin(self.skin_menu_idx)
                            self.menu_state = 'main'

                    # Dead
                    elif self.state == 'dead':
                        if event.key == pygame.K_RETURN:
                            self.start_game()

                    # Enter name
                    elif self.state == 'enter_name':
                        if self.typing_custom:
                            if event.key == pygame.K_RETURN and self.name_input:
                                add_hs(self.name_input, self.score)
                                self.state = 'start'
                                self.menu_state = 'main'
                            elif event.key == pygame.K_BACKSPACE:
                                self.name_input = self.name_input[:-1]
                            elif event.key == pygame.K_ESCAPE:
                                self.typing_custom = False
                                self.name_input = ''
                            elif event.unicode and len(self.name_input) < 12:
                                self.name_input += event.unicode.upper()
                        else:
                            if event.key == pygame.K_UP:
                                self.name_picker_idx = (self.name_picker_idx-1) % len(OFFICE_NAMES)
                            elif event.key == pygame.K_DOWN:
                                self.name_picker_idx = (self.name_picker_idx+1) % len(OFFICE_NAMES)
                            elif event.key == pygame.K_RETURN:
                                if OFFICE_NAMES[self.name_picker_idx] == 'Annet':
                                    self.typing_custom = True
                                    self.name_input = ''
                                else:
                                    add_hs(OFFICE_NAMES[self.name_picker_idx], self.score)
                                    self.state = 'start'
                                    self.menu_state = 'main'



                if hasattr(pygame, 'MOUSEWHEEL') and event.type == pygame.MOUSEWHEEL:
                        mx, my = pygame.mouse.get_pos()
                        if mx < W//2:
                            hs = load_hs()
                            self.hs_scroll = max(0, min(self.hs_scroll - event.y, max(0, len(hs)-10)))
                        else:
                            world = get_world_scores()
                            self.world_scroll = max(0, min(self.world_scroll - event.y, max(0, len(world)-10)))

            # ── Gamepad menu ────────────────────────────────────────────
            if self.state != 'play':
                self.handle_menu_gp(gp)

            # ── Update ──────────────────────────────────────────────────
            self.update_stars(dt)
            self.update(dt, keys, gp)

            # ── Draw ────────────────────────────────────────────────────
            if self.state == 'play':
                self.draw_bg()
                self.draw_track()
                self.draw_particles()
                self.draw_ball()
                self.draw_hud()
            elif self.state == 'dead':
                self.draw_bg()
                self.draw_track()
                self.draw_ball()
                self.draw_dead()
            elif self.state == 'enter_name':
                self.draw_enter_name()
            elif self.state == 'start':
                if self.menu_state == 'skinselect':
                    self.draw_skin_select()
                else:
                    self.draw_start_screen()

            pygame.display.flip()
            self.clock.tick(FPS)

if __name__ == '__main__':
    game = SpaceRollr()
    game.run()
