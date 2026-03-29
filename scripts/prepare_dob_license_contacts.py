#!/usr/bin/env python3
import argparse
import csv
from pathlib import Path


def norm(value: str) -> str:
    return (value or "").strip()


def digits(value: str) -> str:
    return "".join(ch for ch in norm(value) if ch.isdigit())


def choose_better(existing: dict[str, str], candidate: dict[str, str]) -> dict[str, str]:
    existing_score = score(existing)
    candidate_score = score(candidate)
    return candidate if candidate_score > existing_score else existing


def score(row: dict[str, str]) -> tuple[int, int, int]:
    return (
        1 if row["business_phone"] else 0,
        1 if row["license_status"] == "ACTIVE" else 0,
        1 if row["business_email"] else 0,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare cleaned DOB license contact export.")
    parser.add_argument("input_csv", help="Path to DOB license CSV")
    parser.add_argument("output_csv", help="Path for cleaned export")
    args = parser.parse_args()

    input_path = Path(args.input_csv)
    output_path = Path(args.output_csv)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    deduped: dict[tuple[str, str], dict[str, str]] = {}

    with input_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            license_sl_no = digits(row.get("License SL No", ""))
            license_number = digits(row.get("License Number", ""))
            license_type = norm(row.get("License Type", "")).upper()
            if not license_sl_no and not license_number:
                continue

            cleaned = {
                "license_sl_no": license_sl_no,
                "license_type": license_type,
                "license_number": license_number,
                "first_name": norm(row.get("First Name", "")).upper(),
                "last_name": norm(row.get("Last Name", "")).upper(),
                "business_name": norm(row.get("Business Name", "")),
                "business_phone": digits(row.get("Business Phone Number", "")),
                "business_email": norm(row.get("Business Email", "")),
                "license_status": norm(row.get("License Status", "")).upper(),
            }

            key = (cleaned["license_type"], cleaned["license_number"] or cleaned["license_sl_no"])
            current = deduped.get(key)
            deduped[key] = cleaned if current is None else choose_better(current, cleaned)

    fieldnames = [
        "license_type",
        "license_number",
        "license_sl_no",
        "first_name",
        "last_name",
        "business_name",
        "business_phone",
        "business_email",
        "license_status",
    ]

    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in sorted(deduped.values(), key=lambda item: (item["license_type"], item["license_number"], item["license_sl_no"])):
            writer.writerow(row)

    print(f"Wrote {len(deduped)} rows to {output_path}")


if __name__ == "__main__":
    main()
