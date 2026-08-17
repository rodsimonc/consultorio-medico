# Esquema de proyecto — Consultorio Médico "Salud+"

> Blueprint generado siguiendo las convenciones del **Bootcamp** (metodología AIDLC-10x, contrato `specs.md`, arquitectura .NET 8 Web API modular por dominio, plantillas de diseño y de API REST). Es la fase de **Concepción**: define *qué* se construye y *cómo se organiza*, listo para pasar a *Construcción* (scaffolding).

**Fecha:** 2026-08-17 · **Responsable:** @rodsimonc · **Versión del contrato:** 0.1.0

---

## 1. Objetivo del proyecto

Plataforma web para un consultorio médico donde un paciente puede **crear su cuenta**, **buscar médicos por especialidad** y **solicitar un turno**, que queda **guardado en el backend**. El sistema **envía un email automático 1 día antes** de cada turno para que el paciente lo confirme o cancele. El personal del consultorio administra médicos, agendas y el estado de los turnos desde un panel.

Usuarios: **Paciente** (público que se registra) y **Administrador** (personal del consultorio).

---

## 2. Stack

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| Backend runtime | .NET | 8 (LTS) | Convención del Bootcamp (net-core-web-api). |
| Lenguaje backend | C# | 12 | — |
| Framework API | ASP.NET Core Web API | 8 | Arquitectura modular por dominio. |
| ORM | Entity Framework Core | 8 | Modelos centralizados + migraciones idempotentes. |
| Persistencia | PostgreSQL | 16 | Relacional, buen soporte de concurrencia para evitar turnos duplicados. |
| Auth | JWT (Bearer) + hash de contraseña | HS256 / BCrypt | Roles `Paciente` y `Admin`, validado en servidor. |
| Emails | MailKit (SMTP) detrás de `IEmailSender` | — | Envío del recordatorio; proveedor intercambiable (SendGrid/SES). |
| Jobs | `BackgroundService` (Hosted Service) | nativo .NET | Recordatorio 24 h antes, sin dependencias extra. |
| Frontend | React + Vite + TypeScript | React 18 | SPA que consume la API. |
| Estilos frontend | Tailwind CSS + design tokens | 3 | Alineado a `DESIGN.md` y Atomic Design. |
| Estado frontend | React Query (server state) + Context (sesión) | — | Cache de datos del servidor y sesión. |
| Package managers | NuGet (api) · pnpm (web) | — | Versiones fijadas. |

---

## 3. Estructura de carpetas

Monorepo con dos proyectos coordinados (patrón *release-centric* API + Web del Bootcamp).

```
consultorio-medico/
├── api/                                  # .NET 8 Web API (Salud.Api.Consultorio)
│   ├── Salud.Api.Consultorio.csproj
│   ├── Program.cs                        # Bootstrapping + DI + pipeline
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   ├── CLAUDE.md                         # Convenciones para agentes
│   │
│   ├── Auth/                             # Módulo de autenticación (contexto propio)
│   │   ├── Controllers/AuthController.cs
│   │   ├── Services/AuthService.cs
│   │   ├── Dtos/{RegistroRequest,LoginRequest,AuthResponse}.cs
│   │   └── Utils/JwtTokenGenerator.cs
│   │
│   ├── Commons/                          # Capa compartida
│   │   ├── Data/
│   │   │   ├── Models/                   # Entidades EF (Usuario, Medico, Turno, ...)
│   │   │   ├── Enums/                    # RolUsuario, EstadoTurno
│   │   │   └── Persistence/ConsultorioDbContext.cs
│   │   ├── Infrastructure/
│   │   │   └── Notifications/            # IEmailSender + SmtpEmailSender + plantillas
│   │   ├── Presentation/
│   │   │   ├── Controllers/HealthController.cs
│   │   │   └── Errors/ProblemDetailsFactory.cs   # Errores RFC 7807
│   │   ├── Application/Validators/       # FluentValidation
│   │   ├── Constants/ · Enums/ · Utilities/
│   │
│   ├── Modules/                          # Módulos de negocio por dominio
│   │   ├── Medicos/
│   │   │   ├── Medicos/{Controllers,Services,Dtos}/
│   │   │   ├── Especialidades/{Controllers,Services,Dtos}/
│   │   │   └── Disponibilidad/{Controllers,Services,Dtos}/
│   │   └── Turnos/
│   │       ├── Controllers/TurnosController.cs
│   │       ├── Services/{TurnosService,RecordatorioTurnoService}.cs   # el 2º es BackgroundService
│   │       └── Dtos/{TurnoRequest,TurnoResponse}.cs
│   │
│   ├── Extensions/ServiceCollectionExtensions.cs   # Registro DI
│   └── Database/migrations/v1.0.0/*.sql             # Migraciones idempotentes
│
└── web/                                  # React + Vite (Atomic Design)
    ├── package.json
    ├── src/
    │   ├── atoms/ · molecules/ · organisms/         # Componentes
    │   ├── pages/{Registro,Login,BuscarTurno,MisTurnos,Admin}.tsx
    │   ├── api/client.ts                            # fetch con token
    │   ├── store/session.tsx                        # sesión (Context)
    │   └── design-tokens.json                       # fuente de verdad visual
    └── ...
```

**Regla del Bootcamp:** cada flecha del flujo `Vista → Controller → Service → DbContext → Model → SQL` corresponde a una carpeta. Namespaces reflejan carpetas (`Salud.Api.Consultorio.Modules.Turnos.Services`).

---

## 4. Modelo de datos

Entidades EF Core (en `Commons/Data/Models/`, un archivo por clase).

| Entidad | Campos principales | Notas |
|---------|--------------------|-------|
| **UsuarioModel** | Id, Nombre, Apellido, Email (único), PasswordHash, Telefono, Dni, FechaNacimiento, Rol (`Paciente`/`Admin`), CreatedAt | El paciente y el admin son usuarios con rol distinto. |
| **EspecialidadModel** | Id, Nombre (único), Descripcion, Activa | Ej: Clínica, Cardiología, Pediatría. |
| **MedicoModel** | Id, Nombre, Apellido, EspecialidadId (FK), Matricula, Bio, Activo | Un médico pertenece a una especialidad. |
| **DisponibilidadModel** | Id, MedicoId (FK), DiaSemana, HoraInicio, HoraFin, DuracionTurnoMin | Agenda del médico; de acá salen los horarios ofrecidos. |
| **TurnoModel** | Id, PacienteId (FK), MedicoId (FK), FechaHora (UTC), DuracionMin, Estado (`Solicitado`/`Confirmado`/`Cancelado`/`Atendido`/`Ausente`), Motivo, RecordatorioEnviado (bool), TokenConfirmacion (guid), CreatedAt, UpdatedAt | Núcleo del sistema. |
| **NotificacionModel** | Id, TurnoId (FK), Tipo (`Recordatorio`), Destinatario, EnviadoAt, Estado (`Enviado`/`Error`) | Bitácora de emails, para auditoría y no reenviar. |

**Reglas de integridad:**

- Índice **único `(MedicoId, FechaHora)`** para impedir dos turnos en el mismo horario con el mismo médico (evita el doble booking a nivel base).
- Fechas **guardadas en UTC**; se muestran en `America/Argentina/Buenos_Aires`.
- Al crear un turno se valida que el horario **caiga dentro de la disponibilidad** del médico y **no esté ya tomado** (dentro de una transacción con manejo de concurrencia).

---

## 5. API REST (contrato)

Siguiendo el bloque de **componentes básicos API REST** del Bootcamp: recursos en plural, métodos HTTP correctos, códigos de estado por operación, JSON en camelCase, errores con **Problem Details (RFC 7807)**, versión en la ruta (`/api/v1`).

| Método | Ruta | Descripción | Auth | Éxito |
|--------|------|-------------|------|-------|
| POST | `/api/v1/auth/registro` | Crear cuenta de paciente | No | 201 |
| POST | `/api/v1/auth/login` | Login, devuelve JWT | No | 200 |
| GET | `/api/v1/auth/me` | Perfil del usuario logueado | Sí | 200 |
| GET | `/api/v1/especialidades` | Listar especialidades | No | 200 |
| GET | `/api/v1/medicos?especialidadId=` | Listar médicos (filtrable) | No | 200 |
| GET | `/api/v1/medicos/{id}/disponibilidad?fecha=` | Horarios libres de un médico en una fecha | No | 200 |
| POST | `/api/v1/turnos` | Solicitar turno (paciente) | Sí | 201 |
| GET | `/api/v1/turnos` | Mis turnos (paciente) / todos (admin) | Sí | 200 |
| GET | `/api/v1/turnos/{id}` | Detalle de un turno (dueño o admin) | Sí | 200 |
| PATCH | `/api/v1/turnos/{id}/estado` | Cambiar estado (admin: confirmar/atender/ausente) | Admin | 200 |
| DELETE | `/api/v1/turnos/{id}` | Cancelar turno (paciente dueño o admin) | Sí | 204 |
| GET | `/api/v1/turnos/{id}/confirmar?token=` | Confirmar desde el email (link del recordatorio) | Token | 200 |
| POST·PUT·DELETE | `/api/v1/medicos` · `/especialidades` · `/disponibilidad` | ABM del consultorio | Admin | 201/200/204 |

**Contrato de error (uniforme):**

```json
{ "type": "about:blank", "title": "Unprocessable Entity", "status": 422,
  "detail": "El horario elegido ya no está disponible.",
  "instance": "/api/v1/turnos",
  "errors": [ { "field": "fechaHora", "message": "ocupado" } ] }
```

---

## 6. El recordatorio automático por email (pieza clave)

**Objetivo:** 1 día antes del turno, mandar un mail al paciente para que confirme o cancele.

**Cómo funciona (sin dependencias externas de scheduler):**

1. `RecordatorioTurnoService` es un **`BackgroundService`** de .NET que corre en el mismo proceso de la API y se despierta **cada 15 minutos**.
2. En cada ciclo busca los turnos con `FechaHora` **entre 24 h y 25 h** desde ahora, con `RecordatorioEnviado = false` y estado `Solicitado` o `Confirmado`.
3. Por cada uno arma el mail (plantilla HTML) con los datos del turno y **dos botones**: *Confirmar* (link a `GET /turnos/{id}/confirmar?token=…`) y *Cancelar*. El `token` es el `TokenConfirmacion` del turno (evita necesitar login desde el mail).
4. Lo envía vía `IEmailSender` (SMTP con MailKit), marca `RecordatorioEnviado = true` y registra una fila en `NotificacionModel`.
5. Si el envío falla, no marca como enviado y lo reintenta en el próximo ciclo (con tope de reintentos).

**Por qué así:** un `BackgroundService` cada 15 min es simple, no requiere Hangfire/Quartz ni cron externo, y es idempotente gracias al flag `RecordatorioEnviado`. Cuando el volumen crezca, se puede migrar a Hangfire o a un worker separado sin tocar la lógica de negocio (vive detrás de `IEmailSender`).

```
[Cada 15 min]  BackgroundService
      │  busca turnos entre 24h y 25h, sin recordatorio
      ▼
  para cada turno →  IEmailSender.Enviar(plantilla + token)  →  SMTP  →  📧 paciente
      │                                                                     │
      ▼                                                          click "Confirmar"
  marca RecordatorioEnviado=true                                            ▼
  registra Notificacion                                   GET /turnos/{id}/confirmar?token
                                                          → Estado = Confirmado
```

---

## 7. Pantallas (frontend)

Siguiendo `DESIGN.md` (tono sobrio institucional, accesibilidad AA, estados vacíos/carga/error siempre definidos).

| Pantalla | Ruta | Qué hace | Acceso |
|----------|------|----------|--------|
| Registro | `/registro` | Crear cuenta (nombre, email, DNI, teléfono, contraseña con validación) | Público |
| Login | `/login` | Iniciar sesión | Público |
| Inicio / Buscar turno | `/` | Elegir especialidad → médico → fecha → horario libre → confirmar solicitud | Público (pide login al confirmar) |
| Mis turnos | `/mis-turnos` | Lista de turnos del paciente con estado; cancelar | Paciente |
| Panel admin | `/admin` | ABM de médicos, especialidades y agendas; ver y gestionar todos los turnos (confirmar/atender/ausente) | Admin |

Ejemplo de **screen-spec** (formato del Bootcabmp) para "Buscar turno":

```
Propósito: el paciente reserva un turno en 4 pasos guiados.
Ruta y permisos: / (público; al confirmar exige sesión, si no redirige a /login).
Estructura: Header → Stepper (Especialidad · Médico · Fecha · Horario) → Resumen → Botón "Confirmar turno".
Datos: GET /especialidades, GET /medicos?especialidadId=, GET /medicos/{id}/disponibilidad?fecha=, POST /turnos.
Estados: cargando (skeleton de horarios) · vacío ("No hay horarios ese día") · error (toast + reintentar) · éxito (pantalla de confirmación con el turno).
Accesibilidad: navegable por teclado; foco inicial en el select de especialidad; contraste AA.
Qué NO hace: no cobra ni integra pagos (fuera de alcance v0).
```

---

## 8. Product Backlog (épicas e historias)

Formato del Bootcabmp: `[ID] Título — estimación — criterios de aceptación`.

### E1 — Cuentas de paciente
| ID | Título | Est. | Criterios de aceptación |
|----|--------|------|-------------------------|
| CTA-1 | Registro de paciente | 3 | Email válido y único; contraseña ≥8 con letras y números; DNI y teléfono con formato; queda logueado. |
| CTA-2 | Login / logout con JWT | 2 | Credenciales inválidas → 401; token con rol; expira. |

### E2 — Catálogo médico
| ID | Título | Est. | Criterios de aceptación |
|----|--------|------|-------------------------|
| MED-1 | Listar especialidades y médicos | 2 | Filtrable por especialidad; solo activos para el público. |
| MED-2 | ABM de médicos/agenda (admin) | 5 | Admin crea/edita médico, especialidad y disponibilidad; validaciones. |

### E3 — Turnos
| ID | Título | Est. | Criterios de aceptación |
|----|--------|------|-------------------------|
| TUR-1 | Ver horarios libres | 3 | Devuelve solo slots dentro de la disponibilidad y no ocupados. |
| TUR-2 | Solicitar turno | 5 | Requiere login; impide doble booking (índice único + transacción); queda `Solicitado`. |
| TUR-3 | Mis turnos + cancelar | 3 | Paciente ve los suyos; puede cancelar hasta X horas antes. |
| TUR-4 | Gestión de turnos (admin) | 3 | Admin ve todos y cambia estado. |

### E4 — Recordatorio automático
| ID | Título | Est. | Criterios de aceptación |
|----|--------|------|-------------------------|
| NOT-1 | Email 24 h antes | 5 | BackgroundService detecta turnos a ~24 h y envía 1 solo mail; marca enviado; registra notificación. |
| NOT-2 | Confirmar/cancelar desde el mail | 3 | Links con token cambian el estado sin login; token de un solo uso. |

---

## 9. Decisiones cerradas

- **Repo:** monorepo (`api/` + `web/`).
- **Backend:** .NET 8 Web API modular por dominio (convención Bootcamp).
- **Base de datos:** PostgreSQL con EF Core y migraciones idempotentes.
- **Auth:** JWT + hash BCrypt; roles `Paciente` y `Admin`; sin admin por defecto (se crea en el primer arranque o por variables de entorno).
- **Emails:** MailKit/SMTP detrás de `IEmailSender`; recordatorio vía `BackgroundService`.
- **Zona horaria:** persistencia en UTC, presentación en horario argentino.
- **Errores:** Problem Details (RFC 7807) en toda la API.
- **Frontend:** React + Vite + TS + Tailwind, Atomic Design, design tokens.

## 10. Fuera de alcance (v0)

- Pagos / cobros online.
- Historia clínica y registros médicos.
- Recordatorio por SMS/WhatsApp (el mail queda; el resto, después).
- Turnos recurrentes y lista de espera.
- App móvil nativa.

## 11. Roadmap por releases (SemVer)

- **v1.0.0 — MVP:** registro/login, catálogo, solicitar/cancelar turno, panel admin, recordatorio por email.
- **v1.1.0:** confirmación desde el mail con token de un solo uso + bitácora de notificaciones.
- **v1.2.0:** recordatorio por WhatsApp (proveedor detrás de `IEmailSender`-like), lista de espera.

---

**Aprobación:** este contrato queda aprobado cuando @rodsimonc lo confirma. Recién ahí se ejecuta el *scaffolding* (Construcción) generando el árbol de `api/` y `web/`.
