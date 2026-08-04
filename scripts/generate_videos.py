import argparse
import glob
import hashlib
import os
import random
import subprocess
import sys
import uuid

FORMATS = ['mp4', 'mov', 'avi', 'mkv', 'webm']
CHUNK_SIZE = 1024 * 1024
DURATION_S = 8
RESOLUTIONS = [(640, 480), (1280, 720)]

# Moi format can codec/container rieng de ra file THAT choi duoc (khong phai byte rac).
CODEC_MAP = {
    'mp4':  {'vcodec': 'libx264',    'acodec': 'aac',   'preset': ['-preset', 'ultrafast'], 'container': None},
    'mov':  {'vcodec': 'libx264',    'acodec': 'aac',   'preset': ['-preset', 'ultrafast'], 'container': None},
    'mkv':  {'vcodec': 'libx264',    'acodec': 'aac',   'preset': ['-preset', 'ultrafast'], 'container': 'matroska'},
    'avi':  {'vcodec': 'mpeg4',      'acodec': 'mp3',   'preset': [],                       'container': 'avi'},
    'webm': {'vcodec': 'libvpx-vp9', 'acodec': 'libopus', 'preset': ['-deadline', 'realtime', '-cpu-used', '8'],
              'container': 'webm'},
}


def bitrate_kbps_for_target(target_bytes, duration_s, audio_kbps=128, overhead_ratio=0.03):
    total_kbps = (target_bytes * 8) / duration_s / 1000
    video_kbps = (total_kbps - audio_kbps) * (1 - overhead_ratio)
    return max(round(video_kbps), 150)


def generate_video(filepath, ext, size_bytes):
    """Sinh 1 video THAT (h264/vp9 + audio that) bang ffmpeg, choi duoc binh thuong.
    Moi lan goi dung offset seek + tan so am thanh NGAU NHIEN de dam bao noi dung
    (va do do hash) khac nhau giua cac file - server dedup theo hash, trung se hong test."""
    codec = CODEC_MAP[ext]
    width, height = random.choice(RESOLUTIONS)
    kbps = bitrate_kbps_for_target(size_bytes, DURATION_S)
    seek_offset = random.uniform(0, 60)
    audio_freq = random.randint(200, 2000)

    args = [
        'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'lavfi', '-ss', str(seek_offset), '-i', f'testsrc2=size={width}x{height}:rate=30',
        '-f', 'lavfi', '-i', f'sine=frequency={audio_freq}:sample_rate=44100',
        '-t', str(DURATION_S),
        '-c:v', codec['vcodec'],
        '-b:v', f'{kbps}k', '-maxrate', f'{kbps}k', '-bufsize', f'{kbps * 2}k',
        '-pix_fmt', 'yuv420p',
        *codec['preset'],
        '-c:a', codec['acodec'], '-b:a', '128k', '-shortest',
    ]
    if codec['container']:
        args += ['-f', codec['container']]
    args += [filepath]

    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for {filepath}: {result.stderr[-1500:]}")


def get_file_hash(filepath):
    h = hashlib.md5()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(CHUNK_SIZE), b''):
            h.update(chunk)
    return h.hexdigest()


def check_ffmpeg_available():
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("ERROR: 'ffmpeg' khong tim thay trong PATH. Can cai ffmpeg truoc:")
        print("  winget install Gyan.FFmpeg")
        print("Roi mo lai terminal moi de nhan PATH da cap nhat.")
        sys.exit(1)


def parse_args():
    parser = argparse.ArgumentParser(description='Sinh video test THAT (choi duoc) cho k6 upload performance test.')
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
    check_ffmpeg_available()
    os.makedirs(args.output_dir, exist_ok=True)

    formats = [f.strip().lower() for f in args.formats.split(',') if f.strip()]
    unknown = [f for f in formats if f not in CODEC_MAP]
    if unknown:
        print(f"Unknown format(s): {unknown}. Supported: {list(CODEC_MAP.keys())}")
        sys.exit(1)

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

    print(f"Generating {args.count} REAL playable video(s) ({', '.join(formats)}), "
          f"{args.min_size_mb}-{args.max_size_mb} MB each, into '{args.output_dir}'...")
    print(f"(Moi video dai {DURATION_S}s, co audio, encode qua ffmpeg - se cham hon nhieu so voi "
          f"ban random-byte cu. Voi so luong lon (>100), can kien nhan cho.)")

    generated_files = []
    total_size = 0
    format_counts = {}

    for i in range(args.count):
        ext = random.choice(formats)
        size = random.randint(min_bytes, max_bytes)
        filename = f'test-video-{uuid.uuid4().hex[:12]}.{ext}'
        filepath = os.path.join(args.output_dir, filename)

        try:
            generate_video(filepath, ext, size)
        except RuntimeError as e:
            print(f"  ERROR: {e}")
            continue

        try:
            total_size += os.path.getsize(filepath)
            generated_files.append(filepath)
            format_counts[ext] = format_counts.get(ext, 0) + 1
        except OSError:
            print(f"  WARNING: '{filepath}' vanished right after being created (AV/security software?).")
            continue

        actual_mb = os.path.getsize(filepath) / (1024 * 1024)
        print(f'  Generated {i + 1}/{args.count} (target {size / (1024*1024):.1f}MB, actual {actual_mb:.1f}MB, .{ext})')

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
