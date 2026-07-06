import argparse
import glob
import hashlib
import os
import random
import sys
import uuid

from PIL import Image, ImageDraw

SIZES = [
    (800, 600),
    (1920, 1080),
    (3840, 2160),
]
SHAPES_PER_IMAGE = 20


def generate_image(filepath):
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

    img.save(filepath, quality=random.randint(70, 95))


def get_file_hash(filepath):
    with open(filepath, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def parse_args():
    parser = argparse.ArgumentParser(description='Sinh ảnh test unique cho k6 upload performance test.')
    parser.add_argument('--count', type=int, default=1000, help='Số lượng ảnh cần sinh (mặc định: 1000)')
    parser.add_argument('--output-dir', default='assets/images', help='Thư mục output (mặc định: assets/images)')
    return parser.parse_args()


def main():
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    old_files = glob.glob(os.path.join(args.output_dir, 'test-img-*.jpg'))
    for f in old_files:
        os.remove(f)
    if old_files:
        print(f"Removed {len(old_files)} old image(s) from '{args.output_dir}'.")

    print(f"Generating {args.count} images into '{args.output_dir}'...")

    generated_files = []
    for i in range(args.count):
        filename = f'test-img-{uuid.uuid4().hex[:12]}.jpg'
        filepath = os.path.join(args.output_dir, filename)
        generate_image(filepath)
        generated_files.append(filepath)

        if (i + 1) % 100 == 0:
            print(f'  Generated {i + 1}/{args.count}...')

    print("\nVerifying uniqueness (MD5 hash check)...")
    hashes = set()
    duplicates = []

    for filepath in generated_files:
        h = get_file_hash(filepath)
        if h in hashes:
            duplicates.append(filepath)
        hashes.add(h)

    print(f"\n=== RESULT ===")
    print(f"Total images generated : {len(generated_files)}")
    print(f"Unique hashes          : {len(hashes)}")
    print(f"Duplicates found       : {len(duplicates)}")

    if duplicates:
        print("Duplicate files:")
        for d in duplicates:
            print(f"  - {d}")
        sys.exit(1)

    print("All images are 100% unique (no hash collisions).")

    total_size = sum(os.path.getsize(f) for f in generated_files)
    print(f"Total size on disk     : {total_size / (1024*1024):.2f} MB")


if __name__ == '__main__':
    main()
