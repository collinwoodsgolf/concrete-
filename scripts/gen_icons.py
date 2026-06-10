#!/usr/bin/env python3
"""Generate app icons (pure stdlib — no PIL needed).

Draws the Pour Decisions icon: a gray concrete slab with saw-cut control
joints and broom lines on a construction-yellow field.
"""
import os, struct, zlib

YELLOW = (245, 184, 46)
YELLOW_DK = (199, 146, 18)
SLAB = (141, 144, 153)
SLAB_DK = (108, 111, 120)
JOINT = (62, 65, 72)


def draw(size):
    px = bytearray()
    s = size
    border = max(2, s // 24)
    slab_x0, slab_x1 = int(s * 0.14), int(s * 0.86)
    slab_y0, slab_y1 = int(s * 0.30), int(s * 0.84)
    joint_w = max(2, s // 40)
    j1 = slab_x0 + (slab_x1 - slab_x0) // 3
    j2 = slab_x0 + 2 * (slab_x1 - slab_x0) // 3
    jh = slab_y0 + (slab_y1 - slab_y0) // 2
    broom_gap = max(3, s // 36)
    # "rising sun" arc of mud from a chute up top
    chute_cx, chute_cy, chute_r = s // 2, int(s * 0.30), int(s * 0.16)

    for y in range(s):
        for x in range(s):
            c = YELLOW
            if x < border or y < border or x >= s - border or y >= s - border:
                c = YELLOW_DK
            elif slab_x0 <= x < slab_x1 and slab_y0 <= y < slab_y1:
                c = SLAB
                # broom texture: thin horizontal lines
                if (y - slab_y0) % broom_gap == 0:
                    c = SLAB_DK
                # control joints: two vertical + one horizontal groove
                if abs(x - j1) < joint_w or abs(x - j2) < joint_w or abs(y - jh) < joint_w:
                    c = JOINT
                # slab edge
                if (x - slab_x0 < joint_w or slab_x1 - x <= joint_w
                        or y - slab_y0 < joint_w or slab_y1 - y <= joint_w):
                    c = JOINT
            else:
                # pile of fresh mud above the slab
                dx, dy = x - chute_cx, y - chute_cy
                if dy <= 0 and dx * dx + dy * dy < chute_r * chute_r:
                    c = SLAB_DK
            px += bytes(c)
    return bytes(px)


def write_png(path, size):
    raw = draw(size)
    rows = b''.join(b'\x00' + raw[y * size * 3:(y + 1) * size * 3] for y in range(size))
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print(f'wrote {path} ({size}x{size}, {len(png)} bytes)')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(__file__), '..', 'icons')
    os.makedirs(out, exist_ok=True)
    for size in (1024, 512, 192, 180, 167, 152, 120):
        write_png(os.path.join(out, f'icon-{size}.png'), size)
