# YouPass – Notification Service

Tài liệu này mô tả những gì Backend cần implement để hệ thống push notification hoạt động. Implementation hiện tại dùng Node.js/TypeScript, nhưng BE có thể viết lại bằng bất kỳ ngôn ngữ nào (Go, Python, Java…).

---

## Tổng quan

```
[Mobile App]  ──register FCM token──▶  [Notification Service]
                                               │
[Admin/CMS]   ──POST /broadcast──────▶        │──▶  [Firebase FCM]  ──▶  [Device]
```

1. Khi user mở app, app lấy FCM token từ Firebase SDK và gửi lên Notification Service để lưu.
2. Khi muốn gửi thông báo, admin/CMS gọi API broadcast → Notification Service gửi tới tất cả device đã đăng ký.
3. Firebase FCM chịu trách nhiệm deliver notification tới từng device.

---

## Firebase Setup

### 1. Tạo Firebase Project
- Vào https://console.firebase.google.com → Tạo project (hoặc dùng project hiện tại `youpass-notification`)

### 2. Lấy Service Account Key (cho Server)
- Firebase Console → Project Settings → **Service accounts** → **Generate new private key**
- Download file JSON → đây là `FIREBASE_SERVICE_ACCOUNT_JSON`
- **Không commit file này lên git**

### 3. Cấu hình Mobile App
- Firebase Console → Project Settings → Your apps → Add Android App
- Package name: `vn.youpass.app`
- Download `google-services.json` → đặt vào root của React Native project

---

## Database Schema

Chỉ cần 2 bảng chính:

### `devices` – Lưu FCM token của từng thiết bị
```sql
CREATE TABLE devices (
    id         SERIAL PRIMARY KEY,
    user_id    TEXT NOT NULL,        -- ID user (hoặc "broadcast" nếu không có user)
    token      TEXT NOT NULL UNIQUE, -- FCM token từ Firebase SDK
    platform   TEXT NOT NULL,        -- 'ios' | 'android' | 'web'
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX idx_devices_user_id ON devices(user_id);
```

### `notifications` – Lịch sử thông báo đã gửi (optional nhưng nên có)
```sql
CREATE TABLE notifications (
    id         SERIAL PRIMARY KEY,
    user_id    TEXT,            -- NULL nếu là broadcast
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    data       TEXT,            -- JSON string, metadata tuỳ ý
    created_at BIGINT NOT NULL
);
```

> **Lưu ý**: `user_id` trong bảng `devices` không bắt buộc phải trùng với user trong DB chính. App hiện tại gửi `user_id` là ID từ hệ thống auth chính, hoặc không gửi (mặc định `"broadcast"`).

---

## API Endpoints

### Authentication
Tất cả endpoint dùng **API Key** xác thực qua header:
```
x-api-key: <NOTIFY_API_KEY>
```
API Key được set trong environment variable, cả server và mobile app đều dùng chung key này.

---

### 1. Đăng ký thiết bị
**Mobile App gọi sau khi login thành công.**

```
POST /v1/devices
Header: x-api-key: <key>

Body:
{
  "token": "FCM_TOKEN_STRING",   // required – token lấy từ Firebase SDK
  "platform": "android",          // required – "ios" | "android" | "web"
  "user_id": "user-123"           // optional – nếu không có, mặc định "broadcast"
}

Response 200:
{
  "data": {
    "id": 1,
    "token": "FCM_TOKEN_STRING",
    "platform": "android"
  }
}
```

**Logic**:
- Nếu `token` đã tồn tại → update `user_id`, `platform`, `updated_at` (upsert)
- Nếu chưa tồn tại → insert mới
- Lý do upsert: FCM token có thể refresh, app sẽ gửi lại token mới

---

### 2. Xoá thiết bị (khi logout)
```
DELETE /v1/devices/:token
Header: x-api-key: <key>

Response 200:
{
  "data": { "removed": 1 }
}
```

---

### 3. Danh sách thiết bị (debug)
```
GET /v1/devices
Header: x-api-key: <key>

Response 200:
{
  "data": [...],
  "total": 5
}
```

---

### 4. Broadcast – Gửi notification tới TẤT CẢ thiết bị
**Admin/CMS gọi khi muốn push thông báo.**

```
POST /v1/notifications/broadcast
Header: x-api-key: <key>

Body:
{
  "title": "Tiêu đề thông báo",   // required
  "body": "Nội dung thông báo",   // required
  "data": {                         // optional – metadata, mobile app đọc được
    "type": "new_lesson",
    "lesson_id": "123"
  }
}

Response 200:
{
  "data": {
    "successCount": 10,
    "failureCount": 0,
    "invalidTokens": []   // tokens bị lỗi invalid/unregistered, đã tự xoá
  }
}
```

**Logic**:
1. Lấy tất cả token trong bảng `devices`
2. Gọi Firebase Admin SDK `sendEachForMulticast` với danh sách token
3. Các token bị lỗi `messaging/invalid-registration-token` hoặc `messaging/registration-token-not-registered` → **xoá khỏi DB** (token đã expired)
4. Lưu bản ghi vào bảng `notifications` (để có lịch sử)

---

## Tích hợp Firebase Admin SDK

### Gọi Firebase để gửi push

#### Go (dùng `firebase.google.com/go`)
```go
import (
    "context"
    firebase "firebase.google.com/go/v4"
    "firebase.google.com/go/v4/messaging"
    "google.golang.org/api/option"
)

// Khởi tạo
opt := option.WithCredentialsJSON([]byte(os.Getenv("FIREBASE_SERVICE_ACCOUNT_JSON")))
app, _ := firebase.NewApp(context.Background(), nil, opt)
client, _ := app.Messaging(context.Background())

// Gửi broadcast
message := &messaging.MulticastMessage{
    Tokens: tokens, // []string
    Notification: &messaging.Notification{
        Title: title,
        Body:  body,
    },
    Data: data, // map[string]string
    Android: &messaging.AndroidConfig{
        Priority: "high",
    },
    APNS: &messaging.APNSConfig{
        Headers: map[string]string{"apns-priority": "10"},
        Payload: &messaging.APNSPayload{
            Aps: &messaging.Aps{Sound: "default"},
        },
    },
}

response, err := client.SendEachForMulticast(ctx, message)
// response.SuccessCount, response.FailureCount
// response.Responses[i].Error.Code → xoá token nếu invalid
```

### Xử lý token lỗi
Sau khi gửi, kiểm tra từng response:
```go
for i, r := range response.Responses {
    if !r.Success {
        code := r.Error.Code  // hoặc dùng messaging.IsRegistrationTokenNotRegistered(r.Error)
        if code == "registration-token-not-registered" || code == "invalid-registration-token" {
            // xoá tokens[i] khỏi database
        }
    }
}
```

---

## Environment Variables

| Biến | Mô tả | Ví dụ |
|------|--------|--------|
| `NOTIFY_API_KEY` | API key xác thực, dùng chung giữa server và mobile app | `d1d2aaa54172...` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Nội dung file JSON service account Firebase (paste thẳng) | `{"type":"service_account",...}` |
| `PORT` | Port server lắng nghe | `8080` |
| `DATABASE_URL` | Connection string DB | `postgres://...` hoặc path SQLite |

---

## Luồng hoạt động đầy đủ

```
1. User mở app lần đầu
   └─▶ App xin permission notification (Android/iOS)
   └─▶ Firebase SDK trả về FCM token
   └─▶ App gọi POST /v1/devices { token, platform }
   └─▶ Server lưu token vào DB

2. FCM token refresh (Firebase tự làm, app lắng nghe)
   └─▶ App gọi lại POST /v1/devices với token mới
   └─▶ Server upsert (token cũ sẽ bị overwrite nếu cùng device)

3. Admin muốn gửi thông báo
   └─▶ Gọi POST /v1/notifications/broadcast
   └─▶ Server lấy tất cả token từ DB
   └─▶ Gửi qua Firebase FCM
   └─▶ Xoá token invalid (nếu có)
   └─▶ Lưu lịch sử vào bảng notifications

4. User nhận notification
   └─▶ App ở background: system tray hiện notification
   └─▶ App ở foreground: app tự xử lý (hiện Alert hoặc in-app banner)
```

---

## Lưu ý quan trọng

### Token management
- **Không xoá token khi user logout** nếu vẫn muốn gửi notification khi app đóng. Chỉ xoá khi user tắt permission hoặc uninstall.
- Mỗi lần mở app nên gọi lại register để cập nhật token mới nhất.

### Firebase project phải khớp
- `google-services.json` trong mobile app phải cùng Firebase project với service account key trên server.
- Project hiện tại: `youpass-notification` (project number: `715706895675`)

### Scale
- Firebase FCM cho phép gửi tối đa **500 token/request** với `sendEachForMulticast`.
- Nếu có nhiều hơn 500 device, cần chia batch:
```go
for i := 0; i < len(tokens); i += 500 {
    end := min(i+500, len(tokens))
    batch := tokens[i:end]
    // gửi batch
}
```

### Persistent storage
- Không dùng SQLite trên server ephemeral (Render free tier mất data mỗi lần restart).
- Nên dùng PostgreSQL hoặc MySQL.

---

## API hiện đang chạy (để test)

- **Base URL**: `https://youpass-notification.onrender.com`
- **API Key**: xem trong `.env` của project `yp-notify-be`
- **Source**: https://github.com/huynhquoctruongit/youpass-notification
