"""アプリアイコン生成（Pillow）。暗い背景にネオングラデの「ドパ」。"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

S = 1024
bg = Image.new("RGB", (S, S), (11, 11, 26))
# 背景の紫グロー
glow = Image.new("RGB", (S, S), (0, 0, 0))
ImageDraw.Draw(glow).ellipse((-200, -400, S + 200, 600), fill=(70, 20, 120))
bg = Image.blend(bg, glow.filter(ImageFilter.GaussianBlur(160)), 0.7)

# 文字マスク
font = ImageFont.truetype("C:/Windows/Fonts/YuGothB.ttc", 470)
mask = Image.new("L", (S, S), 0)
d = ImageDraw.Draw(mask)
box = d.textbbox((0, 0), "ドパ", font=font)
w, h = box[2] - box[0], box[3] - box[1]
d.text(((S - w) / 2 - box[0], (S - h) / 2 - box[1] - 40), "ドパ", font=font, fill=255)

# ピンク→シアンの横グラデ
grad = Image.new("RGB", (S, S))
gd = ImageDraw.Draw(grad)
a, b = (255, 46, 147), (25, 227, 255)
for x in range(S):
    t = x / (S - 1)
    gd.line([(x, 0), (x, S)], fill=tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)))

# 文字の発光
halo = Image.new("RGB", (S, S), (0, 0, 0))
halo.paste(grad, mask=mask)
bg = Image.composite(bg, bg, mask)
bg = Image.blend(bg, Image.eval(halo.filter(ImageFilter.GaussianBlur(28)), lambda v: v), 0.0)
bg.paste(Image.blend(bg, halo.filter(ImageFilter.GaussianBlur(30)), 0.6), mask=mask.filter(ImageFilter.GaussianBlur(40)).point(lambda v: min(255, v * 2)))
bg.paste(grad, mask=mask)

# 下に「iパス」
f2 = ImageFont.truetype("C:/Windows/Fonts/YuGothB.ttc", 130)
d2 = ImageDraw.Draw(bg)
bx = d2.textbbox((0, 0), "ITパス", font=f2)
d2.text(((S - (bx[2] - bx[0])) / 2 - bx[0], 760), "ITパス", font=f2, fill=(182, 255, 59))

for size, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")]:
    bg.resize((size, size), Image.LANCZOS).save(f"icons/{name}")
print("ok")
