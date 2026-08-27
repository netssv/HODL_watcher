"""Project Map Generator for HODL Watcher following best practices."""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

# Ensure repo root is in path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scripts.map_metadata import PROJECT_METADATA


IGNORED_DIRS = {
    ".git",
    "__pycache__",
    ".pytest_cache",
    ".venv",
    "node_modules",
    "dist",
    ".dev_logs",
    ".codex",
    "hodl_watcher.egg-info",
}

IGNORED_FILES = {".DS_Store", "cache.sqlite"}


def count_lines(filepath: Path) -> int:
    """Return line count for text files, or 0 for binary/empty."""
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            return sum(1 for _ in f)
    except Exception:
        return 0


def determine_layer(rel_path: str) -> str:
    """Classify a relative path into an architectural layer."""
    if rel_path.startswith("api/"):
        return "api"
    if rel_path.startswith("data_ingestion/"):
        return "data_ingestion"
    if rel_path.startswith("features/"):
        return "features"
    if rel_path.startswith("model/"):
        return "model"
    if rel_path.startswith("frontend/"):
        return "frontend"
    if rel_path.startswith(".agents/") or rel_path.startswith("skills"):
        return "agents"
    if rel_path.startswith("tests/"):
        return "tests"
    if rel_path.startswith("docs/"):
        return "docs"
    if rel_path.startswith("scripts/"):
        return "scripts"
    return "root_config"


def scan_repository(root_dir: Path) -> Dict[str, Any]:
    """Scan repo structure, gather file stats, and check compliance."""
    files_list: List[Dict[str, Any]] = []
    layer_stats: Dict[str, Dict[str, int]] = {}
    over_200_lines: List[Dict[str, Any]] = []
    total_loc = 0

    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        rel_dir = os.path.relpath(root, root_dir)

        for filename in sorted(files):
            if filename in IGNORED_FILES:
                continue

            file_path = Path(root) / filename
            rel_path = (
                str(Path(rel_dir) / filename) if rel_dir != "." else filename
            )
            layer = determine_layer(rel_path)
            loc = count_lines(file_path)
            size = file_path.stat().st_size
            ext = file_path.suffix.lower()

            if layer not in layer_stats:
                layer_stats[layer] = {"files": 0, "loc": 0}
            layer_stats[layer]["files"] += 1
            layer_stats[layer]["loc"] += loc
            total_loc += loc

            is_code_file = ext in [".py", ".js", ".jsx", ".css", ".ts", ".tsx"]
            if is_code_file and loc > 200:
                over_200_lines.append(
                    {"path": rel_path, "loc": loc, "layer": layer}
                )

            files_list.append(
                {
                    "path": rel_path,
                    "name": filename,
                    "layer": layer,
                    "loc": loc,
                    "size_bytes": size,
                    "extension": ext,
                }
            )

    return {
        "files": files_list,
        "layer_stats": layer_stats,
        "total_files": len(files_list),
        "total_loc": total_loc,
        "over_200_limit_count": len(over_200_lines),
        "over_200_limit_files": over_200_lines,
    }


def generate_map(root_dir: Path | None = None) -> Dict[str, Any]:
    """Assemble the complete project map JSON payload."""
    if root_dir is None:
        root_dir = Path(__file__).resolve().parent.parent

    repo_stats = scan_repository(root_dir)

    project_map = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project": PROJECT_METADATA,
        "summary": {
            "total_files": repo_stats["total_files"],
            "total_loc": repo_stats["total_loc"],
            "layer_breakdown": repo_stats["layer_stats"],
            "compliance": {
                "rule_200_lines_limit": {
                    "compliant": repo_stats["over_200_limit_count"] == 0,
                    "violations_count": repo_stats["over_200_limit_count"],
                    "violations": repo_stats["over_200_limit_files"],
                }
            },
        },
        "files": repo_stats["files"],
    }

    out_file = root_dir / "project_map.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(project_map, f, indent=2, ensure_ascii=False)

    # Also export embedded JS for standalone offline browser execution
    js_assets_dir = root_dir / "docs" / "map_assets"
    js_assets_dir.mkdir(parents=True, exist_ok=True)
    embedded_file = js_assets_dir / "embedded_map.js"
    with open(embedded_file, "w", encoding="utf-8") as f:
        f.write("window.EMBEDDED_PROJECT_MAP = ")
        json.dump(project_map, f, indent=2, ensure_ascii=False)
        f.write(";\n")

    print(f"✓ Project Map generated successfully at: {out_file}")
    print(f"✓ Embedded Map JS generated at: {embedded_file}")
    print(
        f"  Total Files: {repo_stats['total_files']} | Total LOC: {repo_stats['total_loc']}"
    )
    return project_map


if __name__ == "__main__":
    generate_map()

