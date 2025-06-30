#!/usr/bin/env python3
"""
Switch package namespace between public and internal builds for KleverDesktop.

The public build uses the package name:
    com.klever.desktop

The internal build uses the package name:
    com.grabtaxi.klever

This script updates all source files under the `app` module to the requested
namespace and relocates Kotlin source directories to match the package path.

Usage:
  python switch_package.py --target public   # switch to com.klever.desktop
  python switch_package.py --target internal # switch to com.grabtaxi.klever

The script is idempotent – running it multiple times with the same target has
no effect.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
from pathlib import Path
from typing import Iterable, Tuple

# -------- Utility functions -------------------------------------------------

def _replace_in_file(file_path: Path, replacements: Iterable[Tuple[str, str]]) -> bool:
    """Replace occurrences of old strings with new strings in *file_path*.

    Returns True if the file was modified.
    """
    try:
        content = file_path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return False  # Skip binary or unreadable files

    modified = False
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            modified = True
    if modified:
        file_path.write_text(content, encoding="utf-8")
    return modified


def _move_source_directory(root: Path, src_rel: Path, dst_rel: Path) -> None:
    """Rename/move the Kotlin source directory tree from *src_rel* to *dst_rel*.

    Both paths are relative to *root*. Performs moves only when the source
    exists and destination does not already contain equivalent files.
    """
    src_dir = root / src_rel
    dst_dir = root / dst_rel

    if not src_dir.exists():
        return  # Nothing to move
    dst_dir.parent.mkdir(parents=True, exist_ok=True)
    # If destination exists, merge files; else move entire directory.
    if dst_dir.exists():
        for item in src_dir.rglob("*"):
            relative = item.relative_to(src_dir)
            target_path = dst_dir / relative
            if item.is_dir():
                target_path.mkdir(parents=True, exist_ok=True)
            else:
                target_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(item), str(target_path))
        # Remove now-empty source directories
        shutil.rmtree(src_dir)
    else:
        shutil.move(str(src_dir), str(dst_dir))


# -------- Main processing ---------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Switch package namespace between public and internal builds.")
    parser.add_argument(
        "--target",
        choices=["public", "internal"],
        required=True,
        help="Target build type: 'public' sets package to com.klever.desktop, 'internal' sets to com.grabtaxi.klever.",
    )
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent
    app_src_root = project_root / "app" / "src"

    if not app_src_root.exists():
        print("[ERROR] 'app/src' directory not found. Are you in the KleverDesktop root?")
        return

    if args.target == "public":
        old_pkg, new_pkg = "com.grabtaxi.klever", "com.klever.desktop"
        old_path = Path("com") / "grabtaxi" / "klever"
        new_path = Path("com") / "klever" / "desktop"
    else:  # internal
        old_pkg, new_pkg = "com.klever.desktop", "com.grabtaxi.klever"
        old_path = Path("com") / "klever" / "desktop"
        new_path = Path("com") / "grabtaxi" / "klever"

    print(f"Switching namespace: {old_pkg}  -->  {new_pkg}\n")

    # Prepare replacement tuples for text substitution
    replacements = [
        (old_pkg, new_pkg),
        (str(old_path), str(new_path)),  # path style with '/'
    ]

    modified_files: list[Path] = []
    # Iterate over text files in app module
    patterns = ["*.kt", "*.kts", "*.java", "*.gradle", "*.xml", "*.properties", "*.yml", "*.yaml"]

    for pattern in patterns:
        for file_path in app_src_root.rglob(pattern):
            if _replace_in_file(file_path, replacements):
                modified_files.append(file_path)

    # Additionally update Gradle build scripts at the module root (e.g., build.gradle.kts)
    gradle_files = [project_root / "app" / "build.gradle.kts", project_root / "build.gradle.kts"]
    for gradle_file in gradle_files:
        if gradle_file.exists() and _replace_in_file(gradle_file, replacements):
            modified_files.append(gradle_file)

    # Move directory structure if necessary (affects Kotlin source only)
    kotlin_root = app_src_root / "main" / "kotlin"
    _move_source_directory(kotlin_root, old_path, new_path)

    if modified_files:
        print("Updated files:")
        for p in modified_files:
            print("  -", p.relative_to(project_root))
    else:
        print("No file modifications were necessary – namespace already set to target.")

    print("\nDone.")


if __name__ == "__main__":
    main() 