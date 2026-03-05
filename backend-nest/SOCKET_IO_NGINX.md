# Socket.IO / Call signaling – Nginx proxy

The app uses **Socket.IO** for call signaling (namespace `/call`). The client connects to `http://your-server:port/call` and the Socket.IO engine uses path **`/socket.io/`** for polling and WebSocket.

If you see **"xhr poll error"** in the Android logs while REST API (e.g. `/api/experts/discover`) works, the reverse proxy in front of NestJS is likely **not** forwarding `/socket.io/` to the Node app.

## Fix: proxy `/socket.io/` and WebSocket

Example for **nginx** in front of the NestJS app (e.g. backend on port 5001):

```nginx
server {
    listen 8080;
    server_name 187.77.191.120;   # or your domain

    # REST API
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO – required for call signaling (xhr poll + WebSocket)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }

    # Optional: other paths (uploads, etc.)
    location /uploads/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
    }
}
```

Reload nginx after editing:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Verify

- REST: `curl -s -o /dev/null -w "%{http_code}" http://187.77.191.120:8080/api/health` → 200
- Socket.IO handshake: `curl -s -o /dev/null -w "%{http_code}" "http://187.77.191.120:8080/socket.io/?EIO=4&transport=polling"` → 200 (or 400 with a body, not 404)

If `/socket.io/` returns **404**, the proxy is not forwarding it to NestJS.
