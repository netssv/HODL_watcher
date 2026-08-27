import json
from pathlib import Path
from scripts.generate_project_map import generate_map


def test_project_map_generation():
    root_dir = Path(__file__).resolve().parent.parent
    project_map = generate_map(root_dir)

    assert "$schema" in project_map
    assert project_map["schema_version"] == "1.0.0"
    assert "project" in project_map
    assert "summary" in project_map
    assert "files" in project_map

    summary = project_map["summary"]
    assert summary["total_files"] > 0
    assert summary["total_loc"] > 0
    assert "layer_breakdown" in summary

    # Verify JSON file exists on disk
    json_path = root_dir / "project_map.json"
    assert json_path.exists()

    with open(json_path, "r", encoding="utf-8") as f:
        loaded = json.load(f)
    assert loaded["project"]["name"] == "HODL Watcher"
