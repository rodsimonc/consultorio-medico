# Consultorio Médico "Salud+"

Turnos médicos online: los pacientes se registran, sacan turno con distintos profesionales (que queda guardado en el backend) y reciben un **recordatorio por email un día antes** para confirmar o cancelar. Incluye panel de **recepción** (admin).

Este repo tiene dos cosas:

- **`ESQUEMA.md` + `diagramas.html`** — el *blueprint* del proyecto siguiendo las convenciones del Bootcamp (metodología AIDLC-10x, arquitectura .NET 8 por capas, modelo de datos, API REST, pantallas).
- **La app funcional** (carpetas `src/` y `public/`) — implementación ejecutable en **Node/Express + SQLite**, lista para correr y desplegar.

## Puesta en marcha

```bash
npm install
npm start
# Turnos: http://localhost:3200/   ·   Recepción: http://localhost:3200/admin.html
```

La primera vez se crean especialidades, médicos y agendas de ejemplo. **No hay admin por defecto**: creás la cuenta de recepción la primera vez en `/admin.html`. Los pacientes se registran solos desde la tienda de turnos.

## Cómo funciona

1. El paciente entra a `/`, elige **especialidad → profesional → día → horario**, y confirma (requiere cuenta). El turno queda `solicitado`.
2. Un `BackgroundService` (job cada 15 min) detecta los turnos que caen dentro de **24–25 h** y envía el email con botones **Confirmar / Cancelar** (links con token, sin necesidad de login).
3. La recepción ve todos los turnos en `/admin.html` y cambia su estado.

### Emails

Sin configurar SMTP, el recordatorio funciona en **modo demo** (registra el email en la consola en vez de enviarlo). Para emails reales, completá `SMTP_*` en el `.env`.

Para probar el recordatorio sin esperar, hay un endpoint de desarrollo:
`POST /api/v1/dev/run-recordatorios?now=<epoch_ms>` — dispara el chequeo simulando un momento dado.

## Seguridad y detalles técnicos

- Sin credenciales por defecto; contraseñas con **hash scrypt**; JWT con roles `paciente` / `admin`.
- **Anti doble reserva**: índice único `(médico, fecha_hora)` + validación del horario en el servidor.
- Horarios calculados y mostrados en **horario argentino** (persistencia en UTC).
- Errores con **Problem Details (RFC 7807)**, headers con Helmet, rate limiting en auth.

## Endpoints principales

| Método | Ruta | Acceso |
|--------|------|--------|
| GET | `/api/v1/especialidades` · `/medicos` | público |
| GET | `/api/v1/medicos/{id}/disponibilidad?fecha=` | público |
| POST | `/api/v1/auth/register` · `/register-admin` · `/login` | público |
| POST | `/api/v1/turnos` | paciente |
| GET | `/api/v1/turnos` | admin (todos) / paciente (propios) |
| PATCH | `/api/v1/turnos/{id}/estado` | admin |
| GET | `/api/v1/turnos/{id}/confirmar?token=` | por token (email) |

## Despliegue

Incluye `render.yaml`. Conectás el repo a Render (Blueprint), y acordate de setear `PUBLIC_URL` con la URL pública para que los links del email apunten bien.
