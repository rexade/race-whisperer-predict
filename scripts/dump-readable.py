#!/usr/bin/env python3
"""Dump a calibration dataset JSON to a human-readable text file."""
import json
import sys
from pathlib import Path


def fmt_kmtime(t):
    if not t:
        return "    —   "
    m = t.get("minutes", 0)
    s = t.get("seconds", 0)
    th = t.get("tenths", 0)
    return f"{m}:{s:02d}.{th}"


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("calibration-dataset-6mo.json")
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".readable.txt")

    data = json.loads(src.read_text())

    total_dates = len(data)
    total_races = sum(len(d["races"]) for d in data)
    total_horses = sum(len(r["rawKmTimes"]) for d in data for r in d["races"])

    with out.open("w") as f:
        f.write(f"# {src.name}\n")
        f.write(f"# {total_dates} dates · {total_races} races · {total_horses} horse-entries\n\n")

        for d in data:
            f.write("=" * 100 + "\n")
            f.write(f"DATE: {d['date']}    ({len(d['races'])} races)\n")
            f.write("=" * 100 + "\n")

            for race in d["races"]:
                rd = race.get("raceData", {})
                rid = race.get("raceId")
                rnum = race.get("raceNumber")
                dist = rd.get("distance", "?")
                method = rd.get("startMethod", "?")
                track = rd.get("track", "?")
                name = rd.get("name", "")

                f.write("\n" + "-" * 100 + "\n")
                f.write(f"Race {rnum}  ·  {rid}  ·  {track}  ·  {dist}m {method}")
                if name:
                    f.write(f"  ·  {name}")
                f.write("\n")
                f.write("-" * 100 + "\n")

                # Build a horseId → raw KM time map
                raw_by_id = {str(rt.get("horseId")): rt for rt in race.get("rawKmTimes", [])}
                actual = race.get("actualResults", {})

                # Sort horses by post position
                horses = sorted(rd.get("horses", []), key=lambda h: h.get("postPosition") or 0)

                # Header
                f.write(
                    f"{'Post':<5}{'Horse':<22}{'Driver':<26}"
                    f"{'BestAvg':<10}{'Fastest':<10}{'N':<4}{'Source':<14}"
                    f"{'Gallop%':<9}{'AvgOdds':<9}"
                    f"{'Finish':<8}{'ActualKm':<10}{'Odds':<8}\n"
                )

                for h in horses:
                    hid = str(h.get("horseId"))
                    post = h.get("postPosition", "—")
                    hname = (h.get("name") or "")[:20]
                    drv = h.get("driver") or {}
                    drv_name = f"{drv.get('firstName','')[:1]}.{drv.get('lastName','')}"[:24]

                    rt = raw_by_id.get(hid, {})
                    best = fmt_kmtime(rt.get("bestTime"))           # top-N avg (penalized)
                    rec = fmt_kmtime(rt.get("bestRecordTime"))      # single fastest
                    n = rt.get("validTimesCount", 0)
                    src_chain = rt.get("dataSourceChain") or rt.get("dataSource") or ""
                    src_chain = str(src_chain)[:12]
                    gallop = rt.get("gallopRate")
                    gallop_s = f"{gallop * 100:.0f}%" if isinstance(gallop, (int, float)) else "—"
                    avg_odds = rt.get("averageOdds")
                    avg_odds_s = f"{avg_odds:.1f}" if isinstance(avg_odds, (int, float)) else "—"

                    a = actual.get(hid)
                    if a:
                        finish = str(a.get("position", "—"))
                        akm = fmt_kmtime(a.get("kmTime"))
                        fo = a.get("finalOdds")
                        fo_s = f"{fo:.1f}" if isinstance(fo, (int, float)) else "—"
                    else:
                        finish, akm, fo_s = "—", "    —   ", "—"

                    f.write(
                        f"{str(post):<5}{hname:<22}{drv_name:<26}"
                        f"{best:<10}{rec:<10}{str(n):<4}{src_chain:<14}"
                        f"{gallop_s:<9}{avg_odds_s:<9}"
                        f"{finish:<8}{akm:<10}{fo_s:<8}\n"
                    )

    print(f"Wrote {out}  ({out.stat().st_size / 1_000_000:.1f} MB)")


if __name__ == "__main__":
    main()
