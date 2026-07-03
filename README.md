# TBChat Cloud - Performance Test Upload Ảnh

## Cài đặt lần đầu (sau khi clone)

### 1. Cài công cụ
- Python 3.x: https://www.python.org/downloads/
- Node.js: https://nodejs.org/
- k6: https://k6.io/docs/get-started/installation/
- Pillow: `pip install Pillow`

### 2. Lấy file từ Dev (không có trong repo)
Liên hệ Dev để lấy 2 file sau và đặt đúng vị trí:

| File | Đặt tại |
|------|---------|
| `buildFileTool.exe` | `genfile/upload/` |
| `uploadTool.exe` | `genfile/upload/` |
| `wallet.bin` | `genfile/upload/conf/` |

### 3. Tạo thư mục cần thiết
```powershell
mkdir D:\TBChatPerformance\assets\images
mkdir D:\TBChatPerformance\genfile\upload\index
mkdir D:\TBChatPerformance\genfile\upload\upload
mkdir D:\TBChatPerformance\genfile\upload\conf
mkdir D:\TBChatPerformance\reports
```

---

## Yêu cầu
- Python 3.x + Pillow: `pip install Pillow`
- Node.js
- k6: https://k6.io/docs/get-started/installation/
- `buildFileTool.exe` đặt trong `genfile/upload/`

---

## Cấu trúc thư mục

```
TBChatPerformance/
├── generate_images.py
├── prepare-manifest.js
├── upload-manifest.json
├── assets/
│   └── images/                     ← ảnh test sinh ra
├── genfile/upload/
│   ├── buildFileTool.exe
│   ├── uploadTool.exe
│   ├── conf/wallet.bin
│   ├── index/                      ← JSON body cho từng ảnh (do tool sinh ra)
│   └── upload/                     ← binary slice cho từng ảnh (do tool sinh ra)
├── k6/Cloud/
│   ├── lib/
│   │   └── core.js                 ← logic dùng chung
│   ├── TC01-baseline.js
│   ├── TC02-single-user-100-images.js
│   ├── TC03-concurrent-10-users.js
│   ├── TC04-concurrent-100-users.js
│   ├── TC05-concurrent-1000-users.js
│   └── TC06-spike.js
└── reports/                        ← HTML report sau mỗi lần chạy
```

---

## Quy trình chạy test

### Bước 1 — Sinh ảnh test
```powershell
cd D:\TBChatPerformance
python generate_images.py
```
Sinh 1000 ảnh unique vào `assets/images/`.

---

### Bước 2 — Xử lý ảnh bằng buildFileTool
```powershell
cd D:\TBChatPerformance\genfile\upload
.\buildFileTool.exe -uploadDir="D:\TBChatPerformance\assets\images"
cd D:\TBChatPerformance
```
Tool tạo ra:
- `index/<unique>` — JSON body để POST init
- `upload/http_<unique>_` — binary slice để PUT lên server

> **Lưu ý:** Phải `cd` vào đúng thư mục `genfile/upload` trước khi chạy tool.

---

### Bước 3 — Build manifest
```powershell
cd D:\TBChatPerformance
node prepare-manifest.js
```
Tạo `upload-manifest.json` để k6 đọc vào.

> Mỗi lần chạy lại `buildFileTool.exe` phải chạy lại bước này.

---

### Bước 4 — Chạy test

```powershell
cd D:\TBChatPerformance
k6 run k6/Cloud/<tên-TC>.js
```

---

## Các Test Case

| TC | File | Mô tả |
|----|------|--------|
| TC01 | `TC01-baseline.js` | 1 user upload 1 ảnh — smoke test |
| TC02 | `TC02-single-user-100-images.js` | 1 user upload 100 ảnh tuần tự |
| TC03 | `TC03-concurrent-10-users.js` | 10 user upload đồng thời |
| TC04 | `TC04-concurrent-100-users.js` | 100 user upload đồng thời |
| TC05 | `TC05-concurrent-1000-users.js` | 1000 user upload đồng thời |
| TC06 | `TC06-spike.js` | Spike: tăng đột ngột lên 1000 user trong 5s |

**Ví dụ:**
```powershell
k6 run k6/Cloud/TC01-baseline.js
k6 run k6/Cloud/TC05-concurrent-1000-users.js
```

Report HTML tự động xuất vào:
```
reports/<TC>_<timestamp>.html
```

---

## Verify sau khi test

Lấy `file_hash` bất kỳ từ `upload-manifest.json` và mở trên browser:
```
https://node1.17qpb.com:3065/store/file/<file_hash>
```
Tải được ảnh → upload thật sự thành công.

---

## Đọc kết quả

| Chỉ số | Ý nghĩa |
|--------|---------|
| `files_completed` | Số file upload thành công |
| `http_req_failed` | Tỉ lệ request lỗi (mục tiêu: 0%) |
| `init_duration p(95)` | 95% request POST init hoàn thành trong bao lâu |
| `slice_upload_duration p(95)` | 95% PUT slice hoàn thành trong bao lâu |
| `file_upload_duration p(95)` | 95% upload toàn bộ file hoàn thành trong bao lâu |
| `iteration_duration avg` | Thời gian trung bình upload 1 ảnh hoàn chỉnh |

---

## Lưu ý

- Ảnh test phải unique (hash khác nhau) để tránh server dedup bỏ qua upload.
- Nếu muốn đổi server: sửa `BASE_URL` trong `k6/Cloud/lib/core.js`.
- `uploadTool.exe` chỉ thực hiện bước PUT, không thay thế POST init — không dùng trong k6.
