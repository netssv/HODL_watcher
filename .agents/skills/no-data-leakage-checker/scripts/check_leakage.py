#!/usr/bin/env python3
"""
Static scanner for common time-series data leakage patterns in Python files.
Not exhaustive — a first-pass filter to run before manual review.

Usage:
    python check_leakage.py path/to/file.py
    python check_leakage.py path/to/directory/
"""

import re
import sys
from pathlib import Path

PATTERNS = [
    (
        re.compile(r"train_test_split\([^)]*shuffle\s*=\s*True", re.MULTILINE),
        "shuffle=True in train_test_split — time series splits must be chronological.",
    ),
    (
        re.compile(r"\.rolling\([^)]*center\s*=\s*True"),
        "center=True in a rolling window — this uses future data relative to each row.",
    ),
    (
        re.compile(r"\.shift\(\s*[1-9]\d*\s*\)"),
        "Positive .shift(N) found — check this isn't being used to build a 'current' "
        "feature (positive shift pulls future rows backward). Labels should use "
        "negative shift; features should not use positive shift at all.",
    ),
    (
        re.compile(r"pd\.merge\(([^)]*)\)"),
        "Plain pd.merge() joining time-indexed data — confirm this shouldn't be "
        "merge_asof(direction='backward') to avoid pulling future values.",
    ),
    (
        re.compile(r"fillna\(method\s*=\s*['\"]bfill['\"]\)|\.bfill\("),
        "Backward fill detected — this propagates future values into earlier rows.",
    ),
]


def scan_file(path: Path):
    text = path.read_text(errors="ignore")
    lines = text.splitlines()
    findings = []
    for pattern, message in PATTERNS:
        for match in pattern.finditer(text):
            line_no = text[: match.start()].count("\n") + 1
            snippet = lines[line_no - 1].strip() if line_no - 1 < len(lines) else ""
            findings.append((line_no, message, snippet))
    return findings


def main():
    if len(sys.argv) < 2:
        print("Usage: python check_leakage.py <file_or_directory>")
        sys.exit(1)

    target = Path(sys.argv[1])
    files = [target] if target.is_file() else list(target.rglob("*.py"))

    total_findings = 0
    for f in files:
        findings = scan_file(f)
        if findings:
            print(f"\n{f}")
            for line_no, message, snippet in findings:
                print(f"  L{line_no}: {message}\n         > {snippet}")
            total_findings += len(findings)

    if total_findings == 0:
        print("No obvious leakage patterns found. This is not a guarantee — "
              "still review manually, especially any new feature or split logic.")
    else:
        print(f"\n{total_findings} potential issue(s) found. Review each one manually "
              f"before proceeding.")


if __name__ == "__main__":
    main()
