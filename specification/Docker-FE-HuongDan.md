# Hướng dẫn đóng gói Docker & sử dụng — MKT Hub FE

Repo này là **frontend (React + Vite)**. Các file Docker đã được viết lại cho mục đích FE:
- `Dockerfile` — 2 giai đoạn: build Vite → serve bằng **Nginx**.
- `nginx.conf` — cấu hình Nginx: proxy `/api/*` tới backend + SPA routing fallback.
- `docker-compose.yml` — chạy nhanh bằng 1 lệnh, map port `8080:80`.

> Lưu ý: Docker files cũ (trỏ vào `BE/`, dành cho backend) không còn nữa — đã ghi đè.

---

## 1. Yêu cầu

- Docker + Docker Compose đã chạy (Docker Desktop).
- Không cần cài Node/npm trên máy (build chạy trong container).

## 2. Chạy nhanh bằng Docker Compose

```bash
docker compose up -d --build
```

- App mở tại: **http://localhost:8080**
- Mặc định frontend gọi backend: `https://mkt-hub.onrender.com/api`
- Dừng container: `docker compose down`
- Xem log: `docker compose logs -f`

## 3. Cấu hình backend (API)

API URL được nạp vào bundle lúc build qua biến môi trường `VITE_API_URL` (mặc định lấy từ `.env` hiện tại = `https://mkt-hub.onrender.com/api`).

Chỉ định nơi khác bằng biến môi trường khi chạy compose:

```bash
# Windows PowerShell
$env:VITE_API_URL="https://your-backend.com/api"; $env:BE_UPSTREAM="https://your-backend.com"; docker compose up -d --build
```

Hoặc sửa trực tiếp `.env` (dòng `VITE_API_URL=...`) rồi build lại.

### Nginx `/api` proxy (tùy chọn)
Nginx cũng proxy sẵn `http://localhost:8080/api/*` tới backend (`BE_UPSTREAM`, mặc định `https://mkt-hub.onrender.com`). Hữu ích khi frontend trỏ về cùng domain/port. Ứng dụng mặc định vẫn gọi backend trực tiếp bằng URL tuyệt đối nên không bắt buộc dùng proxy này.

## 4. Build & chạy image thủ công (không compose)

```bash
docker build -t mkt-hub-fe:latest .
docker run -d --name mkt-hub-fe -p 8080:80 mkt-hub-fe:latest
```

Dừng & xóa: `docker stop mkt-hub-fe && docker rm mkt-hub-fe`

## 5. Lệnh hữu ích khác

| Việc | Lệnh |
|------|------|
| Rebuild sau khi sửa code FE | `docker compose up -d --build` |
| Xóa image cũ | `docker image prune -f` |
| Xem app trong container | `docker exec -it mkt-hub-fe /bin/sh` |
| Kiểm tra nginx config đã sub env | `docker exec mkt-hub-fe cat /etc/nginx/conf.d/default.conf` |

## 6. Cấu trúc file

```
Dockerfile          # build 2 tầng: node:18-alpine (vite build) -> nginx:alpine
nginx.conf          # template nginx (envsubst thay ${BE_UPSTREAM})
docker-compose.yml  # build + run nhanh, port 8080:80
.dockerignore       # loại trừ node_modules/dist/.env ra khỏi build context
```

## Lưu ý

- File `.env.local` (chứa token Vercel) **không** được đưa vào image (đã exclude trong `.dockerignore`).
- Image chỉ serve bản build tĩnh `dist/`; mọi thay đổi code FE cần rebuild lại image.
