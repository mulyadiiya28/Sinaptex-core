# WebSocket Contract (Chat — Socket.IO)

Kontrak ini terpisah dari REST karena bentuknya beda (event-based, bukan request/response
per-endpoint). Implementasi: [`src/core/socket.js`](../../src/core/socket.js).

## Connect & Authenticate

Socket.IO nebeng di port HTTP yang sama dengan Express (`http://localhost:4000`, atau domain
production). Autentikasi lewat **handshake**, bukan event terpisah:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: { token: supabaseAccessToken }, // WAJIB, sama seperti Authorization Bearer di REST
});

socket.on('connect', () => console.log('connected'));
socket.on('connect_error', (err) => console.error('auth failed:', err.message));
```

Kalau token tidak ada/invalid/expired, koneksi ditolak di level handshake (`connect_error`),
tidak pernah sampai `connect`. Server memverifikasi token via Supabase (`supabaseAdmin.auth.getUser`),
sama seperti middleware `requireAuth` di REST.

## Join Room

**Otomatis** — begitu autentikasi sukses, server langsung `socket.join('profile:<profileId>')`.
Client TIDAK perlu (dan tidak bisa) join room manual. Semua event personal (pesan masuk, typing,
read receipt) dikirim ke room ini.

## Leave Room

**Otomatis** saat `disconnect` (tutup tab, matikan koneksi, dst) — Socket.IO membersihkan room
membership secara otomatis, tidak perlu event eksplisit.

## Event: Kirim Pesan

```js
socket.emit('message:send', { conversationId, content: 'Halo!' }, (ack) => {
  if (ack.ok) console.log('terkirim:', ack.message);
  else console.error('gagal:', ack.message); // mis. bukan partisipan, pesan kosong
});
```

- **Ack** (callback param ke-2) wajib dipakai client untuk tahu status kirim — jangan asumsikan
  selalu sukses hanya karena tidak ada exception di client.
- Server juga emit `message:new` ke KEDUA partisipan (termasuk pengirim sendiri, untuk sinkron
  multi-device) — lihat bagian "Terima Pesan" di bawah.
- Untuk pesan `IMAGE`/`ATTACHMENT`, TIDAK lewat WebSocket — pakai REST
  `POST /chat/conversations/:id/messages` (multipart upload), broadcast real-time-nya tetap
  terjadi otomatis lewat event bus internal.

## Event: Terima Pesan

```js
socket.on('message:new', (message) => {
  // message: { id, conversationId, senderId, type, content, mediaUrl, mediaName, createdAt, sender }
});
```

## Event: Typing Indicator

```js
socket.emit('typing:start', { conversationId });
socket.emit('typing:stop', { conversationId });

socket.on('typing:start', ({ conversationId, fromProfileId }) => { /* tampilkan "sedang mengetik..." */ });
socket.on('typing:stop', ({ conversationId, fromProfileId }) => { /* sembunyikan */ });
```

Typing indicator murni ephemeral — tidak disimpan ke database, tidak melalui domain event bus
(`eventBus`), langsung diteruskan socket-ke-socket oleh server. Kalau penerima sedang offline,
event ini hilang begitu saja (tidak di-queue) — ini disengaja, bukan bug.

## Event: Read Receipt

```js
socket.emit('conversation:read', { conversationId });

socket.on('conversation:read', ({ conversationId, readBy }) => { /* update centang biru */ });
```

Sama seperti `message:send`, ini juga tersedia lewat REST (`PATCH /chat/conversations/:id/read`)
untuk client yang tidak selalu terkoneksi WebSocket.

## Error Handling

```js
socket.on('error', ({ message }) => { /* tampilkan ke user */ });
```

Dipancarkan server untuk error yang terjadi di luar konteks ack (mis. `typing:start` ke
conversation yang tidak valid — event ini tidak punya ack callback).

## Reconnect

Socket.IO menangani reconnect otomatis (exponential backoff bawaan) — client tidak perlu logic
reconnect manual. Yang perlu diperhatikan client:

- Setelah reconnect, room `profile:<id>` di-join ulang otomatis oleh server.
- Pesan yang terjadi SAAT disconnect TIDAK di-replay otomatis — client sebaiknya panggil
  `GET /chat/conversations/:id/messages` untuk sinkronisasi ulang setelah event `reconnect`,
  supaya tidak ada pesan yang terlewat.

```js
socket.io.on('reconnect', () => {
  // fetch ulang riwayat pesan percakapan yang sedang dibuka, jaga-jaga ada yang terlewat
});
```

## Ringkasan Event

| Event | Arah | Payload |
|---|---|---|
| `message:send` | Client -> Server | `{ conversationId, content }` (+ ack callback) |
| `message:new` | Server -> Client | `Message` object lengkap |
| `typing:start` / `typing:stop` | Client <-> Server | `{ conversationId }` (kirim) / `{ conversationId, fromProfileId }` (terima) |
| `conversation:read` | Client <-> Server | `{ conversationId }` (kirim) / `{ conversationId, readBy }` (terima) |
| `error` | Server -> Client | `{ message }` |
