"""解答例PDF(テキスト層あり)から 問番号→正解(0..3) を座標で対応付けて answers.json に出力"""
import json, re, pymupdf
KANA = {"ア": 0, "イ": 1, "ウ": 2, "エ": 3}
out = {}
for y in ["2024r06", "2025r07", "2026r08"]:
    words = pymupdf.open(f"pdf/{y}_ip_ans.pdf")[0].get_text("words")
    qs = [(w[0], w[1], w[3], int(w[4][1:])) for w in words if re.fullmatch(r"問\d+", w[4])]
    ans = [(w[0], (w[1] + w[3]) / 2, w[4]) for w in words if w[4] in KANA]
    res = {}
    for x0, top, bot, n in qs:
        cy = (top + bot) / 2
        cands = [a for a in ans if a[0] > x0 and abs(a[1] - cy) < (bot - top) / 2]
        a = min(cands, key=lambda a: a[0] - x0)
        res[n] = KANA[a[2]]
    assert sorted(res) == list(range(1, 101)), (y, len(res))
    out[y] = [res[i] for i in range(1, 101)]
json.dump(out, open("answers.json", "w", encoding="utf-8"))
print({k: "".join("アイウエ"[i] for i in v[:12]) for k, v in out.items()})
