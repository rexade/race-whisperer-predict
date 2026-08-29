"""
Does a non-linear model beat the additive one at picking winners?

The production model is strictly additive: every factor contributes seconds
independently, so it cannot represent interactions -- a wide gate mattering more
in a big field, a layoff mattering more for an older horse, driver skill
mattering more from the second row. Gradient boosting can represent those. This
measures whether they are worth anything.

Three models on identical races, so the comparison isolates one thing at a time:

  PURE MARKET   log p_odds + 0.1 * log p_spel. No horse information at all.
  LOGISTIC      linear in the same features the additive model uses, but fitted
                to win probability directly rather than grid-searched on MRR.
  GBM           the same features with interactions available.

Logistic sits between the other two on purpose. If GBM beats the additive model
but logistic matches it, the gain came from the fitting procedure, not from
non-linearity, and the far simpler change is the right one.

Evaluation is per race: rank the field by predicted score, then score where the
actual winner landed. Accuracy on individual horses is meaningless here -- always
predicting "loses" is 92% accurate and useless.

Usage:  python scripts/train_nonlinear.py [--features data/features.csv]
"""
import argparse
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

BETA_SPEL = 0.1  # chosen on train by pure-market.ts

NON_FEATURES = {"raceId", "date", "split", "won"}


def rank_metrics(df: pd.DataFrame, score_col: str) -> dict:
    """Rank each race by score (higher = better) and find the winner's rank."""
    top1 = top3 = top5 = 0
    mrr = 0.0
    n = 0
    for _, race in df.groupby("raceId", sort=False):
        order = race.sort_values(score_col, ascending=False).reset_index(drop=True)
        hit = order.index[order["won"] == 1]
        if len(hit) == 0:
            continue
        rank = int(hit[0]) + 1
        n += 1
        top1 += rank <= 1
        top3 += rank <= 3
        top5 += rank <= 5
        mrr += 1.0 / rank
    return {"n": n, "top1": top1 / n, "top3": top3 / n, "top5": top5 / n, "mrr": mrr / n}


def show(name: str, m: dict) -> None:
    print(f"  {name:<24} n={m['n']:<5} top1 {m['top1']*100:5.1f}%   "
          f"top3 {m['top3']*100:5.1f}%   top5 {m['top5']*100:5.1f}%   MRR {m['mrr']:.4f}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--features", default="data/features.csv")
    args = ap.parse_args()

    df = pd.read_csv(args.features)
    feats = [c for c in df.columns if c not in NON_FEATURES]
    train = df[df["split"] == "train"].copy()
    hold = df[df["split"] == "holdout"].copy()
    print(f"\ntrain {train['raceId'].nunique()} races / holdout {hold['raceId'].nunique()} races")
    print(f"features: {len(feats)}\n")

    # Baseline: the crowd's two numbers, nothing else.
    for d in (train, hold):
        d["mkt"] = d["logPOdds"] + BETA_SPEL * d["logPSpel"]

    Xtr, ytr = train[feats].values, train["won"].values
    Xho = hold[feats].values

    scaler = StandardScaler().fit(Xtr)
    logit = LogisticRegression(max_iter=2000, C=1.0)
    logit.fit(scaler.transform(Xtr), ytr)
    hold["logit"] = logit.predict_proba(scaler.transform(Xho))[:, 1]

    gbm = HistGradientBoostingClassifier(
        max_iter=400, learning_rate=0.05, max_depth=4,
        min_samples_leaf=60, l2_regularization=1.0,
        early_stopping=True, validation_fraction=0.15, random_state=0,
    )
    gbm.fit(Xtr, ytr)
    hold["gbm"] = gbm.predict_proba(Xho)[:, 1]

    # LambdaMART: optimises the ORDER within each race directly, which is the
    # actual objective. A classifier optimises per-horse win probability and is
    # only indirectly a ranker -- it spends capacity separating the 92% of horses
    # that lose from each other, which no ranking metric rewards.
    try:
        from lightgbm import LGBMRanker
        tr_sorted = train.sort_values("raceId")
        ho_sorted = hold.sort_values("raceId")
        groups = tr_sorted.groupby("raceId", sort=False).size().values
        ranker = LGBMRanker(
            objective="lambdarank", metric="ndcg", n_estimators=500,
            learning_rate=0.05, num_leaves=15, min_child_samples=40,
            reg_lambda=1.0, random_state=0, verbose=-1,
        )
        ranker.fit(tr_sorted[feats].values, tr_sorted["won"].values, group=groups)
        ho_sorted["rank_score"] = ranker.predict(ho_sorted[feats].values)
        hold = hold.merge(ho_sorted[["rank_score"]], left_index=True, right_index=True, how="left")
    except ImportError:
        hold["rank_score"] = np.nan

    print("HOLDOUT (identical races for every row):\n")
    show("PURE MARKET", rank_metrics(hold, "mkt"))
    show("LOGISTIC (linear)", rank_metrics(hold, "logit"))
    show("GBM (non-linear)", rank_metrics(hold, "gbm"))
    if hold["rank_score"].notna().any():
        show("LAMBDAMART (ranker)", rank_metrics(hold, "rank_score"))
    print(f"\n  reference: additive production model scored 39.2% top1 / 0.5737 MRR")
    print(f"  on this same race subset.\n")

    # Which features the GBM actually leaned on. Permutation importance on the
    # ranking metric would be better, but this is enough to see whether it found
    # anything beyond the two market columns.
    from sklearn.inspection import permutation_importance
    sub = hold.sample(min(6000, len(hold)), random_state=0)
    imp = permutation_importance(
        gbm, sub[feats].values, sub["won"].values,
        n_repeats=5, random_state=0, scoring="neg_log_loss",
    )
    order = np.argsort(imp.importances_mean)[::-1][:10]
    print("  GBM top features (permutation, neg-log-loss):")
    for i in order:
        print(f"    {feats[i]:<26} {imp.importances_mean[i]:+.5f}")


if __name__ == "__main__":
    main()
