import argparse
import glob
import hashlib
import io
import os
import random
import sys
import uuid

from PIL import Image, ImageDraw

import pillow_avif  # noqa: F401 - registers AVIF plugin on import

SIZES = [
    (800, 600),
    (1920, 1080),
    (3840, 2160),
]
SHAPES_PER_IMAGE = 20

FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'avif']

SAVE_KWARGS = {
    'jpg':  lambda: {'format': 'JPEG', 'quality': random.randint(70, 95)},
    'jpeg': lambda: {'format': 'JPEG', 'quality': random.randint(70, 95)},
    'png':  lambda: {'format': 'PNG', 'compress_level': random.randint(1, 9)},
    'webp': lambda: {'format': 'WEBP', 'quality': random.randint(70, 95)},
    'avif': lambda: {'format': 'AVIF', 'quality': random.randint(70, 95)},
}


def generate_image(filepath, ext):
    width, height = random.choice(SIZES)

    img = Image.new(
        'RGB', (width, height),
        color=(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
    )
    draw = ImageDraw.Draw(img)

    for _ in range(SHAPES_PER_IMAGE):
        x1, x2 = sorted([random.randint(0, width), random.randint(0, width)])
        y1, y2 = sorted([random.randint(0, height), random.randint(0, height)])
        if x1 == x2:
            x2 += 1
        if y1 == y2:
            y2 += 1
        draw.ellipse(
            [x1, y1, x2, y2],
            fill=(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
        )

    img.save(filepath, **SAVE_KWARGS[ext]())


def get_file_hash(filepath):
    with open(filepath, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def probe_formats(formats):
    working, broken = [], {}
    probe_img = Image.new('RGB', (4, 4))
    for ext in formats:
        try:
            buf = io.BytesIO()
            probe_img.save(buf, **SAVE_KWARGS[ext]())
            working.append(ext)
        except Exception as e:
            broken[ext] = str(e)
    return working, broken


def parse_args():
    parser = argparse.ArgumentParser(description='Sinh ảnh test unique cho k6 upload performance test.')
    parser.add_argument('--count', type=int, default=1000, help='Số lượng ảnh cần sinh (mặc định: 1000)')
    parser.add_argument('--output-dir', default='assets/images', help='Thư mục output (mặc định: assets/images)')
    parser.add_argument(
        '--formats', default=','.join(FORMATS),
        help=f'Danh sách định dạng, phân cách bởi dấu phẩy (mặc định: {",".join(FORMATS)})'
    )
    return parser.parse_args()


def main():
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    formats = [f.strip().lower() for f in args.formats.split(',') if f.strip()]
    unknown = [f for f in formats if f not in SAVE_KWARGS]
    if unknown:
        print(f"Unknown format(s): {unknown}. Supported: {list(SAVE_KWARGS.keys())}")
        sys.exit(1)

    formats, broken = probe_formats(formats)
    if broken:
        print("Some formats are unavailable on this machine and will be skipped:")
        for ext, err in broken.items():
            print(f"  - {ext}: {err}")
    if not formats:
        print("No usable formats left. Aborting.")
        sys.exit(1)

    old_files = glob.glob(os.path.join(args.output_dir, 'test-img-*.*'))
    removed, locked = 0, []
    for f in old_files:
        try:
            os.remove(f)
            removed += 1
        except OSError:
            locked.append(f)
    if removed:
        print(f"Removed {removed} old image(s) from '{args.output_dir}'.")
    if locked:
        print(f"Skipped {len(locked)} old file(s) locked by another process (e.g. antivirus scanning).")

    print(f"Generating {args.count} images ({', '.join(formats)}) into '{args.output_dir}'...")

    generated_files = []
    format_counts = {}
    total_size = 0
    vanished = []
    write_failed = 0

    for i in range(args.count):
        ext = random.choice(formats)
        filename = f'test-img-{uuid.uuid4().hex[:12]}.{ext}'
        filepath = os.path.join(args.output_dir, filename)

        try:
            generate_image(filepath, ext)
        except OSError:
            write_failed += 1
            continue

        try:
            total_size += os.path.getsize(filepath)
            generated_files.append(filepath)
            format_counts[ext] = format_counts.get(ext, 0) + 1
        except OSError:
            vanished.append(filepath)

        if (i + 1) % 100 == 0:
            print(f'  Generated {i + 1}/{args.count}...')

    print("\nVerifying uniqueness (MD5 hash check)...")
    hashes = set()
    duplicates = []

    for filepath in generated_files:
        try:
            h = get_file_hash(filepath)
        except OSError:
            vanished.append(filepath)
            continue
        if h in hashes:
            duplicates.append(filepath)
        hashes.add(h)

    print(f"\n=== RESULT ===")
    print(f"Format distribution     : {format_counts}")
    print(f"Write failed            : {write_failed}")
    print(f"Total images generated  : {len(generated_files)}")
    print(f"Vanished after creation : {len(vanished)}")
    print(f"Unique hashes           : {len(hashes)}")
    print(f"Duplicates found        : {len(duplicates)}")

    if vanished:
        print("\nSome files disappeared from disk right after being created")
        print("(likely quarantined/removed by antivirus or endpoint security software).")
        print(f"Example: {vanished[0]}")

    if duplicates:
        print("Duplicate files:")
        for d in duplicates:
            print(f"  - {d}")
        sys.exit(1)

    print("All images are 100% unique (no hash collisions).")
    print(f"Total size on disk      : {total_size / (1024*1024):.2f} MB")


if __name__ == '__main__':
    main()
