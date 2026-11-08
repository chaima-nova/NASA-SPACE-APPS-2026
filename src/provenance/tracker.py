"""
src/provenance/tracker.py
Provenance tracking: record every pipeline action in a structured JSONL log.
Provides immutable audit trail of all data transformations.
"""
from __future__ import annotations

import json
import logging
import os
import platform
import time
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ProvenanceTracker:
    """
    Append-only provenance log for the entire pipeline run.
    Each record is written as a single line of JSON (JSONL format).
    """

    def __init__(self, log_path: Path):
        self.log_path = Path(log_path)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self._run_id = f"run_{int(time.time())}"
        self._write({
            "event": "pipeline_start",
            "run_id": self._run_id,
            "python_version": platform.python_version(),
            "platform": platform.system(),
            "cwd": os.getcwd(),
        })

    def _write(self, record: dict) -> None:
        record.setdefault("timestamp", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        record["run_id"] = self._run_id
        with open(self.log_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record) + "\n")

    def record_download(self, dataset_id: str, download_record: dict) -> None:
        self._write({
            "event": "download",
            "dataset_id": dataset_id,
            **download_record,
        })

    def record_processing(
        self,
        dataset_id: str,
        step: str,
        input_path: Optional[Path] = None,
        output_path: Optional[Path] = None,
        detail: Any = None,
    ) -> None:
        self._write({
            "event": "processing",
            "dataset_id": dataset_id,
            "step": step,
            "input": str(input_path) if input_path else None,
            "output": str(output_path) if output_path else None,
            "detail": detail,
        })

    def record_validation(self, dataset_id: str, report: dict) -> None:
        self._write({
            "event": "validation",
            "dataset_id": dataset_id,
            "summary": report.get("summary"),
        })

    def record_error(self, dataset_id: str, step: str, error: str) -> None:
        self._write({
            "event": "error",
            "dataset_id": dataset_id,
            "step": step,
            "error": error,
        })

    def finalize(self, summary: dict) -> None:
        self._write({"event": "pipeline_end", "summary": summary})
