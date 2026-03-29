#!/usr/bin/env python3
import argparse
import csv
import json
from pathlib import Path


def norm(value: str) -> str:
    return (value or "").strip()


def digits(value: str) -> str:
    return "".join(ch for ch in norm(value) if ch.isdigit())


def canonical_license(value: str) -> str:
    normalized = digits(value).lstrip("0")
    return normalized or "0"


def contact_name(first_name: str, last_name: str, business_name: str) -> str:
    personal = " ".join(part for part in [norm(first_name), norm(last_name)] if part)
    return personal or norm(business_name)


def score(row: dict[str, str]) -> tuple[int, int, int]:
    return (
        1 if row["phone"] else 0,
        1 if row["license_status"] == "ACTIVE" else 0,
        1 if row["contact_name"] else 0,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build phone lookup JSON for permit feed.")
    parser.add_argument("input_csv", help="Path to DOB license CSV")
    parser.add_argument("output_json", help="Path to JSON output")
    args = parser.parse_args()

    deduped: dict[str, dict[str, str]] = {}

    with Path(args.input_csv).open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            license_number = canonical_license(row.get("License Number", "") or row.get("License SL No", ""))
            if not license_number:
                continue

            business_name = norm(row.get("Business Name", ""))
            cleaned = {
                "license_number": license_number,
                "business_name": business_name,
                "contact_name": contact_name(row.get("First Name", ""), row.get("Last Name", ""), business_name),
                "phone": digits(row.get("Business Phone Number", "")),
                "license_status": norm(row.get("License Status", "")).upper(),
                "license_type": norm(row.get("License Type", "")).upper(),
            }

            current = deduped.get(license_number)
            if current is None or score(cleaned) > score(current):
                deduped[license_number] = cleaned

    output_path = Path(args.output_json)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(sorted(deduped.values(), key=lambda row: row["license_number"]), f, indent=2)
        f.write("\n")

    print(f"Wrote {len(deduped)} lookup rows to {output_path}")


if __name__ == "__main__":
    main()
