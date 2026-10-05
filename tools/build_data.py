"""data/parts/*.json を結合して data/past.json / data/original.json を作り、形式を検証する。
使い方: python tools/build_data.py
"""
import glob, json, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTS = os.path.join(ROOT, "data", "parts")
FIELDS = {"strategy", "management", "technology"}
# 問題冊子に印刷された分野の区切り（ストラテジ系の最終問, マネジメント系の最終問）
FIELD_RANGES = {"R06": (35, 55), "R07": (35, 55), "R08": (34, 54)}
REQUIRED = ["id", "source", "field", "category", "q", "choices", "answer", "explain", "credit", "modified"]


def load(pattern):
    items = []
    for f in sorted(glob.glob(os.path.join(PARTS, pattern))):
        if f.endswith("_excluded.json"):
            continue
        items += json.load(open(f, encoding="utf-8"))
    return items


def validate(items, source, answers=None):
    errors, ids = [], set()
    for q in items:
        qid = q.get("id", "?")
        for k in REQUIRED:
            if k not in q:
                errors.append(f"{qid}: {k} がない")
        if qid in ids:
            errors.append(f"{qid}: ID重複")
        ids.add(qid)
        if q.get("source") != source:
            errors.append(f"{qid}: source={q.get('source')}")
        if q.get("field") not in FIELDS:
            errors.append(f"{qid}: field={q.get('field')}")
        ch = q.get("choices", [])
        if len(ch) != 4 or not all(isinstance(c, str) and c.strip() for c in ch):
            errors.append(f"{qid}: choices が4つの文字列でない")
        if any(c.strip()[:1] in "アイウエ" and c.strip()[1:2] in " 　" for c in ch):
            errors.append(f"{qid}: 選択肢に記号が残っている")
        if q.get("answer") not in (0, 1, 2, 3):
            errors.append(f"{qid}: answer={q.get('answer')}")
        if not q.get("explain"):
            errors.append(f"{qid}: explain が空")
        t = q.get("table")
        if t is not None and not (isinstance(t, list) and all(isinstance(r, list) for r in t)):
            errors.append(f"{qid}: table の形式")
        if source == "past":
            no = q.get("no")
            if not q.get("credit", "").startswith("出典："):
                errors.append(f"{qid}: credit")
            s_end, m_end = FIELD_RANGES.get(qid[:3], (35, 55))
            exp_field = "strategy" if no <= s_end else "management" if no <= m_end else "technology"
            if q.get("field") != exp_field:
                errors.append(f"{qid}: field は {exp_field} のはず")
            if answers:
                key = {"R06": "2024r06", "R07": "2025r07", "R08": "2026r08"}[qid[:3]]
                if answers[key][no - 1] != q["answer"]:
                    errors.append(f"{qid}: 正解キーと不一致")
    return errors


def main():
    answers = json.load(open(os.path.join(ROOT, "tools", "answers.json"), encoding="utf-8"))
    past = sorted(load("R*.json"), key=lambda q: q["id"])
    orig = sorted(load("orig_*.json"), key=lambda q: q["id"])
    errs = validate(past, "past", answers) + validate(orig, "original")
    for name, items in [("past", past), ("original", orig)]:
        with open(os.path.join(ROOT, "data", f"{name}.json"), "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{name}: {len(items)}問", dict(collections.Counter(q["field"] for q in items)),
              "answer分布", dict(sorted(collections.Counter(q["answer"] for q in items).items())))
    excluded = []
    for f in sorted(glob.glob(os.path.join(PARTS, "*_excluded.json"))):
        excluded += json.load(open(f, encoding="utf-8"))
    print(f"除外: {len(excluded)}問")
    if errs:
        print("\n".join(errs))
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
