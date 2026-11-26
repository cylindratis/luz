"""Aggregate ONS constrained-off records into a compact daily series for Pages."""

import argparse
import csv
import io
import json
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen

BASE = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset"
KEYS = {"N": "norte", "NE": "nordeste", "SE": "sudesteECentroOeste",
        "SE/CO": "sudesteECentroOeste", "SE-CO": "sudesteECentroOeste", "S": "sul"}
DATASETS = {"eolica": "eolica", "solar": "fotovoltaica"}


def add_month(data, stream):
    seen = set()
    records = csv.DictReader(stream, delimiter=";")
    expected = {"din_instante", "id_ons", "id_subsistema", "val_geracaonaorealizadaapurada"}
    if not expected.issubset(records.fieldnames or []):
        raise ValueError("campos obrigatórios ausentes na base do ONS")
    for row in records:
        timestamp = datetime.fromisoformat(row["din_instante"])
        if timestamp.minute not in (0, 30):
            raise ValueError("intervalo do ONS diferente de 30 minutos")
        if not row["id_ons"] or not row["id_subsistema"]:
            raise ValueError("chave de usina ou subsistema ausente")
        key = (row["din_instante"], row["id_ons"])
        if key in seen:
            raise ValueError(f"registro duplicado no ONS: {key}")
        seen.add(key)
        day = timestamp.date().isoformat()
        region = KEYS.get(row["id_subsistema"], row["id_subsistema"])
        reasons = data.setdefault(day, {}).setdefault(region, defaultdict(float))
        value = row["val_geracaonaorealizadaapurada"]
        if value:
            # GNRa is the average unused power over one half-hour settlement interval.
            # The individual reason durations are not a second multiplier.
            energy = max(float(value), 0) * 0.5
            reasons[row["cod_razaorestricao"] or "outros"] += energy
    if not seen:
        raise ValueError("arquivo do ONS sem registros")


def month_labels(at):
    return sorted({(at - timedelta(days=offset)).strftime("%Y_%m") for offset in range(38)})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inputs", type=Path, help="pasta contendo os CSVs oficiais para execução offline")
    parser.add_argument("--at", type=date.fromisoformat, default=datetime.now(timezone(timedelta(hours=-3))).date())
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "src/data/curtailment.json")
    args = parser.parse_args()
    result = {}
    for kind, dataset in DATASETS.items():
        data = {}
        for month in month_labels(args.at):
            if args.inputs:
                with (args.inputs / f"{dataset}-{month}.csv").open(encoding="utf-8-sig") as stream:
                    add_month(data, stream)
                continue
            url = f"{BASE}/restricao_coff_{dataset}_tm/RESTRICAO_COFF_{dataset.upper()}_{month}.csv"
            try:
                with urlopen(url, timeout=55) as response:
                    with io.TextIOWrapper(response, encoding="utf-8-sig") as stream:
                        add_month(data, stream)
            except HTTPError as error:
                if error.code not in (404, 403) or month != args.at.strftime("%Y_%m"):
                    raise
        if not data:
            raise ValueError(f"sem dados publicados de {kind}")
        result[kind] = data
    common = sorted(set(result["eolica"]) & set(result["solar"]))
    if not common or (args.at - date.fromisoformat(common[-1])).days > 8:
        raise ValueError("fontes do ONS sem uma referência recente comum")
    for kind, data in result.items():
        print(kind, min(data), max(data), "·", round(sum(sum(r.values()) for d in data.values() for r in d.values()), 2), "MWh")
    args.out.write_text(json.dumps({"reference": common[-1], "retrieved": args.at.isoformat(), "data": result},
                                   ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")


if __name__ == "__main__":
    main()
