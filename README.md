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
mkdir D:\TBChatPerformance\genfile\upload\conf
mkdir D:\TBChatPerformance\data
mkdir D:\TBChatPerformance\reports
```

---

## Cấu trúc thư mục

```
TBChatPerformance/
├── scripts/
│   ├── generate_images.py
│   └── prepare-manifest.js
├── data/
│   └── upload-manifest.json        ← manifest sinh ra, k6 đọc vào
├── assets/
│   └── images/                     ← ảnh test sinh ra
├── genfile/upload/
│   ├── buildFileTool.exe
│   ├── uploadTool.exe
│   ├── conf/wallet.bin
│   ├── index/                      ← JSON body cho từng ảnh (do tool sinh ra)
│   └── upload/                     ← binary slice cho từng ảnh (do tool sinh ra)
├── k6-tests/Cloud/
│   ├── config/
│   │   └── enviroment.js           ← chọn server test (dev/qa) + đường dẫn manifest
│   ├── lib/
│   │   ├── core.js                 ← logic dùng chung (init + PUT slice)
│   │   └── report.js               ← sinh report HTML sau khi test
│   ├── TC01-baseline.js
│   ├── TC02-single-user-100-images.js
│   ├── TC03-concurrent-100-users.js
│   ├── TC04-concurrent-500-users.js
│   ├── TC05-concurrent-1000-users.js
│   └── TC06-spike.js
└── reports/                        ← HTML report sau mỗi lần chạy
```

---

## Quy trình chạy test

### Bước 1 — Sinh ảnh test
```powershell
cd D:\TBChatPerformance
python scripts/generate_images.py --count 1000
```
Sinh 1000 ảnh unique vào `assets/images/` (tự xoá ảnh cũ trước khi sinh mới).

Tuỳ chọn:
- `--count <n>` — số ảnh cần sinh (mặc định 1000)
- `--output-dir <path>` — thư mục output (mặc định `assets/images`)

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
node scripts/prepare-manifest.js
```
Tạo `data/upload-manifest.json` để k6 đọc vào.

> Mỗi lần chạy lại `buildFileTool.exe` phải chạy lại bước này.
> Script tự xác định thư mục gốc dự án, chạy được từ bất kỳ đâu (không cần `cd` vào đúng thư mục).

---

### Bước 4 — Chạy test

```powershell
cd D:\TBChatPerformance
k6 run k6-tests/Cloud/<tên-TC>.js
```

**Chọn server test** qua biến `ENV` (định nghĩa trong `k6-tests/Cloud/config/enviroment.js`):

```powershell
k6 run -e ENV=qa k6-tests/Cloud/TC01-baseline.js   # mặc định nếu không truyền -e ENV
k6 run -e ENV=dev k6-tests/Cloud/TC01-baseline.js  # cần điền baseUrl cho "dev" trong enviroment.js trước
```

---

## Các Test Case

| TC | File | Mô tả |
|----|------|--------|
| TC01 | `TC01-baseline.js` | 1 user upload 1 ảnh — smoke test |
| TC02 | `TC02-single-user-100-images.js` | 1 user upload 100 ảnh tuần tự |
| TC03 | `TC03-concurrent-100-users.js` | 100 user upload đồng thời |
| TC04 | `TC04-concurrent-500-users.js` | 500 user upload đồng thời |
| TC05 | `TC05-concurrent-1000-users.js` | 1000 user upload đồng thời |
| TC06 | `TC06-spike.js` | Spike: tăng đột ngột lên 1000 user trong 5s |

**Ví dụ:**
```powershell
k6 run k6-tests/Cloud/TC01-baseline.js
k6 run k6-tests/Cloud/TC05-concurrent-1000-users.js
```

Report HTML tự động xuất vào:
```
reports/<TC>_<timestamp>.html
```

---

## Verify sau khi test

### Cách 1 — Tải file qua URL (nhanh, trực quan)

```
https://node8.17qpb.com:3065/store/file/<file_hash>
```

Lấy `file_hash` từ `data/upload-manifest.json` (field `init_body.file_hash`), mở URL trên browser hoặc dùng curl:

```powershell
curl -k -s -o /dev/null -w "HTTP Status: %{http_code}`nContent-Type: %{content_type}`nSize: %{size_download} bytes`n" "https://node8.17qpb.com:3065/store/file/<file_hash>"
```

| Kết quả | Ý nghĩa |
|---------|---------|
| `200` + tải được ảnh | File đã upload thành công |
| `404` | File chưa tồn tại trên server |

> Lưu ý: dùng `node8`, không phải `node1` (node dùng để upload). File lưu trên node khác với node nhận request upload.

### Cách 2 — Gọi lại POST init

Nếu file đã upload, server trả về `Status=1`:
```powershell
cd D:\TBChatPerformance\genfile\upload
$body = Get-Content ".\index\<unique>" -Raw
Invoke-RestMethod -Method POST -Uri "https://node1.17qpb.com:3065/api/v2/upload/init" -ContentType "application/json" -Body $body
```
`data.Status = 1` → file đã có trên server (upload thành công).
`data.Status = 2` → file chưa có → upload chưa thành công.

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
- Muốn đổi server: sửa `baseUrl` trong `k6-tests/Cloud/config/enviroment.js`, không sửa trực tiếp trong `core.js`.
- `uploadTool.exe` chỉ thực hiện bước PUT, không thay thế POST init — không dùng trong k6.
