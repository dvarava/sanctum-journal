from __future__ import annotations

import shutil
import subprocess
import tempfile
from struct import pack
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
SOURCE_ICON_PATH = ROOT_DIR / "build" / "appicon.png"
DARWIN_ICON_PATH = ROOT_DIR / "build" / "darwin" / "iconfile.icns"
WEBSITE_ICON_PATH = ROOT_DIR / "sanctum-journal-website" / "assets" / "appicon.png"

ICONSET_SIZES = {
    "icon_16x16@2x.png": 32,
    "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512,
    "icon_512x512@2x.png": 1024,
}

ICNS_CHUNKS = (
    ("ic07", "icon_128x128.png"),
    ("ic08", "icon_256x256.png"),
    ("ic09", "icon_512x512.png"),
    ("ic10", "icon_512x512@2x.png"),
    ("ic11", "icon_16x16@2x.png"),
    ("ic12", "icon_32x32@2x.png"),
    ("ic13", "icon_128x128@2x.png"),
    ("ic14", "icon_256x256@2x.png"),
)


def run_command(args: list[str]) -> None:
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def build_icns_chunk(chunk_type: str, payload: bytes) -> bytes:
    return chunk_type.encode("ascii") + pack(">I", len(payload) + 8) + payload


def build_icns_with_macos_tools(source: Path, target: Path) -> None:
    if shutil.which("sips") is None:
        raise SystemExit("Missing macOS image tool: expected 'sips'.")

    with tempfile.TemporaryDirectory() as temp_dir:
        iconset_dir = Path(temp_dir) / "icon.iconset"
        iconset_dir.mkdir(parents=True, exist_ok=True)

        for filename, size in ICONSET_SIZES.items():
            run_command(
                [
                    "sips",
                    "-z",
                    str(size),
                    str(size),
                    str(source),
                    "--out",
                    str(iconset_dir / filename),
                ]
            )

        target.parent.mkdir(parents=True, exist_ok=True)
        chunk_payloads = []
        for chunk_type, filename in ICNS_CHUNKS:
            payload = (iconset_dir / filename).read_bytes()
            chunk_payloads.append((chunk_type, payload))

        toc_entries = b"".join(
            chunk_type.encode("ascii") + pack(">I", len(payload) + 8)
            for chunk_type, payload in chunk_payloads
        )
        toc_chunk = build_icns_chunk("TOC ", toc_entries)
        icon_chunks = b"".join(build_icns_chunk(chunk_type, payload) for chunk_type, payload in chunk_payloads)
        icns_data = b"icns" + pack(">I", 8 + len(toc_chunk) + len(icon_chunks)) + toc_chunk + icon_chunks
        target.write_bytes(icns_data)


def main() -> None:
    if not SOURCE_ICON_PATH.exists():
        raise SystemExit(f"Missing source icon: {SOURCE_ICON_PATH}")

    build_icns_with_macos_tools(SOURCE_ICON_PATH, DARWIN_ICON_PATH)
    WEBSITE_ICON_PATH.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE_ICON_PATH, WEBSITE_ICON_PATH)

    print(f"Synced icon assets from {SOURCE_ICON_PATH}")


if __name__ == "__main__":
    main()
