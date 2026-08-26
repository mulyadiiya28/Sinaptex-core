# Monitoring Guide

> **Status: TEMPLATE dasar — observability penuh belum diimplementasi (lihat Phase 14 di
> `PROJECT_CHECKLIST.md`: structured logging, error tracking, metrics, alerting).**

## Yang Sudah Ada
- `GET /api/health` — health check sederhana (belum cek koneksi DB/Cloudinary secara aktif)
- `morgan` HTTP request logging ke stdout (mode `dev` di development)

## Rencana Monitoring (belum diimplementasi)

### Application Monitoring
- Structured logger (pino/winston) menggantikan `console.log`
- Error tracking (Sentry) untuk exception tak tertangani

### Infrastructure Monitoring
- Uptime check eksternal (mis. UptimeRobot/BetterStack) memanggil `/api/health` tiap 1-5 menit
- Metrics dasar: response time, error rate, request/sec — via APM (mis. Datadog/New Relic)
  atau self-host (Prometheus + Grafana)

### Database Monitoring
- Manfaatkan dashboard bawaan Supabase (query performance, connection pool usage)
- Alert jika koneksi DB mendekati limit

### Alerting
- **TEMPLATE — tentukan channel alert** (Slack/email/WhatsApp) dan threshold
  (mis. error rate > 5% dalam 5 menit, response time p95 > 1s)

## Metric Bisnis yang Perlu Dipantau (bukan cuma teknis)
- Jumlah Opportunity aktif per hari
- Match yang dihasilkan vs Invitation yang dikirim (conversion funnel)
- Invitation accept rate
- Deal completion rate vs cancel rate
- Revenue dari Boost package (setelah payment gateway real terpasang)
