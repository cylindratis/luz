"""Compare complete twelve-hour periods from the two hourly ONS datasets."""

import argparse
import csv
import io
import json
from collections import defaultdict
from datetime import datetime, time, timedelta, timezone
from math import isfinite
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen

BASE = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset"
BRASILIA = timezone(timedelta(hours=-3))
ONE_HOUR = timedelta(hours=1)
REGIONS = {"N": "norte", "NE": "nordeste", "SE": "sudesteECentroOeste", "S": "sul"}
CORRIDORS = {("N", "NE"), ("N", "SE"), ("NE", "SE"), ("S", "SE")}
FIELDS = {"hidraulica": "val_gerhidraulica", "termica": "val_gertermica",
          "eolica": "val_gereolica", "solar": "val_gersolar"}
BALANCE = "balanco_energia_subsistema"
INTERCHANGE = "intercambio_nacional"


def rows(dataset, year, inputs):
    name = f"{dataset.upper()}_{year}.csv"
    if inputs:
        with (inputs / name).open(encoding="utf-8-sig") as file:
            yield from csv.DictReader(file, delimiter=";")
    else:
        with urlopen(f"{BASE}/{dataset}_ho/{name}", timeout=30) as response:
            with io.TextIOWrapper(response, encoding="utf-8-sig") as file:
                yield from csv.DictReader(file, delimiter=";")


def timestamp(row):
    return datetime.fromisoformat(row["din_instante"]).replace(tzinfo=BRASILIA)


def value(row, field):
    result = float(row[field])
    if not isfinite(result):
        raise ValueError(f"valor inválido: {field}")
    return result


def load_tables(now, inputs):
    balance, interchange = defaultdict(dict), defaultdict(dict)
    years = sorted({now.year, (now - timedelta(days=10)).year})
    for year in years:
        for dataset, table in ((BALANCE, balance), (INTERCHANGE, interchange)):
            try:
                for row in rows(dataset, year, inputs):
                    instant = timestamp(row)
                    if instant < now - timedelta(days=10) or instant + ONE_HOUR > now:
                        continue
                    if dataset == BALANCE:
                        key = row["id_subsistema"].strip()
                        if key not in REGIONS:
                            continue
                        measurement = {name: value(row, field) for name, field in FIELDS.items()}
                        measurement["load"] = value(row, "val_carga")
                    else:
                        origin = row["id_subsistema_origem"].strip()
                        destination = row["id_subsistema_destino"].strip()
                        key = tuple(sorted((origin, destination)))
                        if key not in CORRIDORS:
                            continue
                        amount = value(row, "val_intercambiomwmed")
                        if amount < 0:
                            raise ValueError("ONS alterou a convenção de sentido do intercâmbio")
                        measurement = amount if key[0] == origin else -amount
                    if key in table[instant]:
                        raise ValueError(f"registro duplicado: {dataset} {instant} {key}")
                    table[instant][key] = measurement
            except HTTPError as error:
                if error.code not in (403, 404) or len(years) == 1 or year != now.year:
                    raise
    return balance, interchange


def average_period(start, hours, balance, interchange):
    def mean(items):
        return round(sum(items) / len(hours), 3)

    regions = {REGIONS[key]: {
        "sources": {source: mean([balance[hour][key][source] for hour in hours]) for source in FIELDS},
        "load": mean([balance[hour][key]["load"] for hour in hours]),
    } for key in REGIONS}
    links = []
    for origin, destination in sorted(CORRIDORS):
        mw = mean([interchange[hour][origin, destination] for hour in hours])
        if mw < 0:
            origin, destination, mw = destination, origin, -mw
        links.append({"from": REGIONS[origin], "to": REGIONS[destination], "mw": mw})
    return {"start": start.isoformat(), "end": (hours[-1] + ONE_HOUR).isoformat(),
            "regions": regions, "links": links}


def summarize(now, balance, interchange):
    for day in range(8):
        dawn = datetime.combine(now.date() - timedelta(days=day), time(6), tzinfo=BRASILIA)
        starts = {"dia": dawn, "noite": dawn - timedelta(hours=12)}
        periods = {key: [start + ONE_HOUR * i for i in range(12)] for key, start in starts.items()}
        if all(set(balance.get(hour, {})) == REGIONS.keys() and set(interchange.get(hour, {})) == CORRIDORS
               for hours in periods.values() for hour in hours):
            return {key: average_period(starts[key], hours, balance, interchange) for key, hours in periods.items()}
    raise ValueError("sem dia e noite completos nas duas bases do ONS")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inputs", type=Path, help="pasta com os CSVs oficiais por ano")
    parser.add_argument("--at", type=datetime.fromisoformat, default=datetime.now(BRASILIA))
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "src/data/intercambios.json")
    args = parser.parse_args()
    now = args.at.astimezone(BRASILIA) if args.at.tzinfo else args.at.replace(tzinfo=BRASILIA)
    result = summarize(now, *load_tables(now, args.inputs))
    args.out.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    for key, window in result.items():
        print(key, window["start"], window["end"])


if __name__ == "__main__":
    main()
