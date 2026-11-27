"""Prepare browser-sized derivatives of the supplied EPE tables."""

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

import shapefile
from openpyxl import load_workbook

SITE = Path(__file__).resolve().parents[1]
DATA = SITE / "src" / "data"


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")


def workbook(path):
    return load_workbook(path, read_only=True, data_only=True)


def simplify(points, tolerance, polygon):
    if len(points) <= 2:
        return [[round(x, 4), round(y, 4)] for x, y in points]
    result = [points[0]]
    for point in points[1:-1]:
        dx, dy = point[0] - result[-1][0], point[1] - result[-1][1]
        if dx * dx + dy * dy >= tolerance * tolerance:
            result.append(point)
    result.append(points[-1])
    if polygon and len(result) < 4:
        result = points
    return [[round(x, 4), round(y, 4)] for x, y in result]


def geometry(shape, polygon):
    if shape.shapeType in (1, 11, 21):
        return simplify(shape.points, 0, False)[0] if shape.points else None
    if shape.shapeType in (3, 5, 13, 15, 23, 25):
        parts = [*shape.parts, len(shape.points)]
        tolerance = 0.019 if polygon else 0.006
        return [simplify(shape.points[a:b], tolerance, polygon) for a, b in zip(parts, parts[1:])]
    return None


def map_data(path):
    layers = []
    categories = {
        "CGH": "CGH", "PCH": "PCH", "UHE": "UHE", "EOL": "eólicas", "UFV": "solares",
        "UTE_Biomassa": "biomassa", "UTE_Fóssil": "térmicas fósseis", "UTE_Nuclear": "nucleares",
        "Linhas_de_Transmissão": "transmissão", "Subestações": "subestações",
        "Sistemas_Isolados": "sistemas isolados", "Subsistema_do_Sistema_Interligado_Nacional": "limites do SIN",
    }
    preferred = {"nome", "localidade", "uf", "subsistee", "municipio", "tensao", "extensao",
                 "potencia", "concession", "ano_opera", "ano_planej", "ano_prev", "ini_oper",
                 "rio", "ceg", "combust", "distribuid", "reg_geog"}
    for shp in sorted(path.glob("*.shp")):
        if "SIRGAS_2000" not in shp.with_suffix(".prj").read_text():
            raise ValueError(f"projeção inesperada: {shp}")
        group = shp.stem.split("_-_")[0]
        if group not in categories:
            raise ValueError(f"camada nova: {group}")
        mode = "planejada" if "Planejada" in shp.stem else "existente" if "Existente" in shp.stem else "neutra"
        kind = "polygon" if group.startswith("Subsistema_do") else "line" if group.startswith("Linhas_") else "point"
        key = f"epe-{len(layers) + 1:02}"
        reader = shapefile.Reader(str(shp), encoding="utf-8")
        xml = shp.with_suffix(".shp.xml")
        edition = None
        if xml.exists():
            import re
            match = re.search(r"<CreaDate>(\d{4})(\d{2})(\d{2})</CreaDate>", xml.read_text(encoding="utf-8-sig"))
            if match:
                edition = "-".join(match.groups())
        features = []
        for item in reader.iterShapeRecords():
            coords = geometry(item.shape, kind == "polygon")
            if coords is None:
                raise ValueError(f"geometria não suportada: {shp} {item.shape.shapeType}")
            properties = {
                k.lower(): v.isoformat() if hasattr(v, "isoformat") else v
                for k, v in item.record.as_dict().items()
                if k.lower() in preferred and v not in (None, "")
            }
            features.append([coords, properties])
        write_json(DATA / "mapa" / f"{key}.json", features)
        layers.append(dict(id=key, name=categories[group], kind=kind, mode=mode,
                           source=shp.stem, count=len(features), metadataDate=edition))
    if len(layers) != 22:
        raise ValueError(f"esperadas 22 camadas, encontradas {len(layers)}")
    write_json(DATA / "mapa" / "camadas.json", layers)
    print("mapa:", len(layers), "camadas,", sum(x["count"] for x in layers), "feições")


def historical(path):
    book = workbook(path)
    years = defaultdict(lambda: {"consumo": defaultdict(float), "fontes": {}})
    for row in book.active.iter_rows(min_row=2, values_only=True):
        year, value = row[6:8]
        if not isinstance(year, int) or not isinstance(value, (int, float)):
            continue
        if row[21] == "TABELA 2.30" and row[1] == "GWh":
            flow = row[22]
            result = years[year]
            if flow == "Produção":
                result["publica" if "Público" in row[23] else "autoproducao"] = value
            if flow in ("Importação", "Exportação", "Perdas"):
                key = {"Importação": "importacao", "Exportação": "exportacao", "Perdas": "perdas"}[flow]
                result[key] = abs(value)
            if flow == "Consumo Total" and row[24] == "Consumo Final Energético" and row[25]:
                result["consumo"][row[25].lower()] += value
        if row[0] == "TABELA 5.3" and row[14] == "Geração de Eletricidade" and str(row[37]).strip() == "GWh":
            years[year]["fontes"][row[36].lower()] = value
    output = []
    for year, row in sorted(years.items()):
        production = row["publica"] + row["autoproducao"]
        consumption = sum(row["consumo"].values())
        difference = production + row["importacao"] - row["exportacao"] - row["perdas"] - consumption
        output.append(dict(ano=year, geracao=production, consumoTotal=consumption, diferenca=difference, **row))
    assert [row["ano"] for row in output] == list(range(1970, 2026))
    write_json(DATA / "historico.json", output)
    print("histórico:", len(output), "anos; maior diferença absoluta em GWh:",
          round(max(abs(row["diferenca"]) for row in output), 3))


def parse_number(string):
    return float(string.replace(".", "").replace(",", ".").removesuffix("%"))


def read_pne_table(path):
    with path.open(encoding="utf-8-sig", newline="") as file:
        first = file.readline()
        separator = ";" if ";" in first else ","
        columns = next(csv.reader([first], delimiter=separator))
        for row in csv.reader(file, delimiter=separator):
            if len(row) == 1 and separator == ",":
                row = next(csv.reader(row))
            if not row or not row[0].strip().isdigit():
                continue
            if len(row) != len(columns):
                raise ValueError(f"{path.name}: número de colunas incompatível: {row}")
            yield row


class Plan:
    def __init__(self):
        self.metrics = {}

    def add(self, metric, unit, source, year, scenario, group, value):
        entry = self.metrics.setdefault(metric, {"name": metric, "unit": unit, "source": source, "series": {}})
        key = (scenario, group)
        series = entry["series"].setdefault(key, {})
        series[year] = series.get(year, 0) + value

    def export(self):
        return [dict(name=m["name"], unit=m["unit"], source=m["source"], series=[
            dict(scenario=scenario, group=group, points=sorted(series.items()))
            for (scenario, group), series in m["series"].items()
        ]) for m in self.metrics.values()]


def pde(path):
    plan = Plan()
    main = workbook(next(path.glob("*Painel de Resultados*")))
    for table, title, unit in [
        ("Capacidade instalada total", "capacidade instalada", "GW"),
        ("Geração eletrica", "geração elétrica", "TWh"),
        ("Emissões", "emissões", "MtCO₂e"),
        ("Expansão incremental", "expansão incremental de geração", "MW"),
    ]:
        for row in main[table].iter_rows(min_row=2, values_only=True):
            if not isinstance(row[0], int) or not isinstance(row[-1], (float, int)):
                continue
            labels = [s for s in row[1:-1] if isinstance(s, str)]
            if table == "Geração eletrica":
                labels.reverse()
            plan.add(title, unit, f"painel de resultados, aba {table}", row[0], "referência",
                     " · ".join(labels), row[-1])
    for year, matrix, detail, source, value in main["Matrizes"].iter_rows(min_row=2, values_only=True):
        if isinstance(year, int) and isinstance(value, (int, float)) and source == "ELETRICIDADE" and "CONSUMO FINAL" in str(matrix):
            plan.add("consumo final de eletricidade", "ktep", "painel de resultados, aba matrizes", year,
                     "referência", str(detail).strip(), value)
    lines = workbook(next(path.glob("*Capítulo 04*")))
    sheet = lines["Figura 4-24"]
    for row in sheet.iter_rows(min_row=7, values_only=True):
        if isinstance(row[0], int):
            for label, value in zip(("230 kV", "345 kV", "440 kV", "500 kV", "800 kV", "total"), row[1:]):
                plan.add("expansão acumulada de transmissão", "km", "capítulo 4, figura 4-24",
                         row[0], "referência", label, value)
    return plan.export()


def pne(path):
    plan = Plan()
    specs = [
        ("Capacidade_Instalada.csv", [("capacidade instalada", "GW", 4)], (2,)),
        ("Geração elétrica.csv", [("geração elétrica", "TWh", 7)], (4, 3)),
        ("Consumo Final.csv", [("consumo final de eletricidade", "ktep", 5)], (4,)),
        ("Eficiência energética.csv", [("eficiência energética", "%", 3)], (2,)),
        ("Emissões de GEE.csv", [("emissões", "MtCO₂e", 4)], (2, 3)),
        ("MMGD e Baterias atras do medidor.csv", [
            ("capacidade de baterias atrás do medidor", "GWh", 2),
            ("adotantes de MMGD", "milhões de adotantes", 3),
            ("adotantes de baterias", "milhões de adotantes", 4),
        ], ()),
    ]
    for file, metrics, group_columns in specs:
        for row in read_pne_table(path / file):
            if file == "Consumo Final.csv" and row[2].strip().lower() != "eletricidade":
                continue
            group = " · ".join(row[i].strip() for i in group_columns) or "total"
            for metric, unit, value_index in metrics:
                if row[value_index].strip():
                    plan.add(metric, unit, file, int(row[0]), row[1].strip(), group, parse_number(row[value_index]))
    return plan.export()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inputs", type=Path, default=SITE.parent / "proximo passo")
    args = parser.parse_args()
    map_data(args.inputs / "dados EPE")
    historical(args.inputs / "historico de producao.xlsx")
    plans = {"PDE 2035": pde(args.inputs / "PDE 2035"), "PNE 2055": pne(args.inputs / "PNE 2055")}
    write_json(DATA / "planos.json", plans)
    print("planos:", {name: len(metrics) for name, metrics in plans.items()})


if __name__ == "__main__":
    main()
