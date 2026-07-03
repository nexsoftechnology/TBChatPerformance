from PIL import Image, ImageDraw
import random
import os
import uuid
import hashlib

OUTPUT_DIR = 'assets/images'
NUM_IMAGES = 100
SIZES = [
    (800, 600),
    (1920, 1080),
    (3840, 2160),
]
SHAPES_PER_IMAGE = 20

os.makedirs(OUTPUT_DIR, exist_ok=True)


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


def main():
    print(f"Generating {NUM_IMAGES} images into '{OUTPUT_DIR}'...")

    generated_files = []
    for i in range(NUM_IMAGES):
        filename = f'test-img-{uuid.uuid4().hex[:12]}.jpg'
        filepath = os.path.join(OUTPUT_DIR, filename)
        generate_image(filepath)
        generated_files.append(filepath)

        if (i + 1) % 100 == 0:
            print(f'  Generated {i + 1}/{NUM_IMAGES}...')

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
    else:
        print("All images are 100% unique (no hash collisions).")

    total_size = sum(os.path.getsize(f) for f in generated_files)
    print(f"Total size on disk     : {total_size / (1024*1024):.2f} MB")


if __name__ == '__main__':
    main()
