import argparse
import glob
import hashlib
import os
import random
import sys
import uuid

FORMATS = ['mp4', 'mov', 'avi', 'mkv', 'webm']
CHUNK_SIZE = 1024 * 1024


def generate_video(filepath, size_bytes):
    with open(filepath, 'wb') as f:
        remaining = size_bytes
        while remaining > 0:
            n = min(CHUNK_SIZE, remaining)
            f.write(os.urandom(n))
            remaining -= n


def get_file_hash(filepath):
    h = hashlib.md5()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(CHUNK_SIZE), b''):
            h.update(chunk)
    return h.hexdigest()


def parse_args():
    parser = argparse.ArgumentParser(description='Sinh video test giả lập (random binary) cho k6 upload performance test.')
    parser.add_argument('--count', type=int, default=10, help='Số lượng video cần sinh (mặc định: 10)')
    parser.add_argument('--output-dir', default='assets/videos', help='Thư mục output (mặc định: assets/videos)')
    parser.add_argument('--min-size-mb', type=float, default=5, help='Size nhỏ nhất mỗi video, MB (mặc định: 5)')
    parser.add_argument('--max-size-mb', type=float, default=20, help='Size lớn nhất mỗi video, MB (mặc định: 20)')
    parser.add_argument(
        '--formats', default=','.join(FORMATS),
        help=f'Danh sách định dạng, phân cách bởi dấu phẩy (mặc định: {",".join(FORMATS)})'
    )
    return parser.parse_args()


def main():
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    formats = [f.strip().lower() for f in args.formats.split(',') if f.strip()]

    old_files = glob.glob(os.path.join(args.output_dir, 'test-video-*.*'))
    removed, locked = 0, []
    for f in old_files:
        try:
            os.remove(f)
            removed += 1
        except OSError:
            locked.append(f)
    if removed:
        print(f"Removed {removed} old video(s) from '{args.output_dir}'.")
    if locked:
        print(f"Skipped {len(locked)} old file(s) locked by another process.")

    min_bytes = int(args.min_size_mb * 1024 * 1024)
    max_bytes = int(args.max_size_mb * 1024 * 1024)

    print(f"Generating {args.count} video(s) ({', '.join(formats)}), "
          f"{args.min_size_mb}-{args.max_size_mb} MB each, into '{args.output_dir}'...")

    generated_files = []
    total_size = 0
    format_counts = {}

    for i in range(args.count):
        ext = random.choice(formats)
        size = random.randint(min_bytes, max_bytes)
        filename = f'test-video-{uuid.uuid4().hex[:12]}.{ext}'
        filepath = os.path.join(args.output_dir, filename)

        generate_video(filepath, size)

        try:
            total_size += os.path.getsize(filepath)
            generated_files.append(filepath)
            format_counts[ext] = format_counts.get(ext, 0) + 1
        except OSError:
            print(f"  WARNING: '{filepath}' vanished right after being created (AV/security software?).")
            continue

        print(f'  Generated {i + 1}/{args.count} ({size / (1024*1024):.1f} MB, .{ext})')

    print("\nVerifying uniqueness (MD5 hash check)...")
    hashes = set()
    duplicates = []
    for filepath in generated_files:
        try:
            h = get_file_hash(filepath)
        except OSError:
            continue
        if h in hashes:
            duplicates.append(filepath)
        hashes.add(h)

    print(f"\n=== RESULT ===")
    print(f"Format distribution    : {format_counts}")
    print(f"Total videos generated : {len(generated_files)}")
    print(f"Unique hashes          : {len(hashes)}")
    print(f"Duplicates found       : {len(duplicates)}")

    if duplicates:
        print("Duplicate files:")
        for d in duplicates:
            print(f"  - {d}")
        sys.exit(1)

    print("All videos are 100% unique (no hash collisions).")
    print(f"Total size on disk     : {total_size / (1024*1024):.2f} MB")


if __name__ == '__main__':
    main()
