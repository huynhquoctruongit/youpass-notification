# yp-notify-be

Backend đơn giản phục vụ push notification cho app `yp` (React Native + Firebase).

- **Stack**: Node.js + Express + TypeScript
- **DB**: SQLite (better-sqlite3, file `data.sqlite`)
- **Auth**: JWT (HS256)
- **Push**: Firebase Admin SDK (FCM)

## 1. Cài đặt

```bash
cd yp-notify-be
npm install
cp .env.example .env
```

## 2. Cấu hình Firebase Admin

Vào Firebase Console → **Project Settings → Service accounts → Generate new private key** để tải file JSON.

Đặt file vào root project và đổi tên thành `firebase-service-account.json` (đã được `.gitignore`).

Hoặc set env `FIREBASE_SERVICE_ACCOUNT_JSON` chứa nội dung JSON (tiện cho deploy).

Nếu thiếu service account, server vẫn chạy nhưng `POST /v1/notifications/send` sẽ trả lỗi 500.

## 3. Chạy

```bash
npm run dev      # tsx watch (dev)
npm run build    # build sang dist/
npm start        # chạy production
```

Mặc định listen `http://localhost:4000`.

## 4. API

Tất cả endpoint (trừ `/health` và `/v1/login`) yêu cầu header `Authorization: Bearer <jwt>`.

### `GET /health`
Trả `{ status: "ok", time }`.

### `POST /v1/login`
Mock auth — nếu email chưa tồn tại sẽ tự tạo user.

```json
Request:  { "username": "test@youpass.vn", "password": "123456" }
Response: { "data": { "access_token": "...", "user": { ... } } }
```

### `GET /v1/users/me`
Trả profile của user hiện tại.

### `POST /v1/users/me/devices`
Đăng ký FCM device token. Upsert theo `token`.

```json
Request:  { "token": "<fcm-token>", "platform": "ios" | "android" | "web" }
Response: { "data": { "id": 1, "token": "...", "platform": "ios" } }
```

### `DELETE /v1/users/me/devices/:token`
Hủy đăng ký device.

### `GET /v1/users/me/devices`
List devices của user hiện tại.

### `POST /v1/notifications/send`
Gửi push tới một user.

```json
Request:
{
  "to_self": true,                       // (tuỳ chọn) gửi cho chính mình
  "user_id": "<uuid>",                   // (tuỳ chọn) gửi cho user khác
  "title": "Tiêu đề",
  "body": "Nội dung",
  "data": { "screen": "study", "id": "42" }   // (tuỳ chọn) data payload
}

Response:
{ "data": { "successCount": 1, "failureCount": 0, "invalidTokens": [] } }
```

Nếu cả `to_self` và `user_id` đều bỏ trống thì gửi cho chính user gọi API.

Token không hợp lệ sẽ bị xoá tự động khỏi DB.

### `POST /v1/notifications/broadcast`
Gửi push tới TẤT CẢ thiết bị đã đăng ký.

```json
Request:  { "title": "...", "body": "...", "data": {...} }
```

### `GET /v1/notifications`
Lịch sử notifications của user hiện tại.

## 5. Tích hợp với app `yp`

Trong `yp/.env` đổi `EXPO_PUBLIC_API` về URL của BE này:

```
EXPO_PUBLIC_API=http://192.168.61.84:4000
```

Lưu ý thiết bị thật cần dùng IP LAN của máy (vd `http://192.168.61.84:4000`).

App sẽ tự:
1. Login → lấy `access_token`.
2. Hook `usePushNotifications` xin permission, lấy FCM token.
3. Gọi `POST /v1/users/me/devices` để đăng ký token.

## 6. Thử gửi push nhanh bằng curl

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:4000/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test@youpass.vn","password":"123456"}' \
  | jq -r '.data.access_token')

# 2. Mở app trên thiết bị, login cùng email/password → BE sẽ lưu FCM token.

# 3. Gửi push
curl -X POST http://localhost:4000/v1/notifications/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to_self":true,"title":"Xin chào","body":"Đây là test push"}'
```

## 7. Cấu trúc thư mục

```
src/
  db/
    index.ts           # init sqlite + schema
    users.ts           # users repo
    devices.ts         # devices repo
    notifications.ts   # notifications repo
  middleware/
    auth.ts            # JWT bearer auth
    error.ts           # error handler (Zod, generic)
  routes/
    auth.ts            # POST /v1/login
    users.ts           # /v1/users/me + /v1/users/me/devices
    notifications.ts   # /v1/notifications/*
  services/
    auth.ts            # JWT sign/verify
    firebase.ts        # Firebase Admin init + sendPush
    userMapper.ts      # user -> profile DTO
  server.ts            # entry
```
