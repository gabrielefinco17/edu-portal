# Captive Portal — Gestione Collegi Docenti

Sistema web per la gestione digitale delle sedute del collegio docenti scolastico. Permette la registrazione delle presenze tramite token monouso, la votazione su proposte all'ordine del giorno e la consultazione dello storico delle sedute.

Progetto sviluppato dalla classe 5D — Informatica e Telecomunicazioni, dell'ITTS Vito Volterra di San Donà di Piave.

👉 Per il manuale d'uso, consulta il file [ManualeUtente.md](./ManualeUtente.md).

---

## Indice

- [Stack tecnologico](#stack-tecnologico)
- [Architettura del sistema](#architettura-del-sistema)
- [Struttura del database](#struttura-del-database)
- [Deploy](#deploy)
- [Gestione degli account](#gestione-degli-account)
- [API Reference](#api-reference)
- [Manuale utente](#manuale-utente)
- [Logging](#logging)
- [Note di sicurezza](#note-di-sicurezza)

---

## Stack tecnologico

| Layer      | Tecnologia                        |
|------------|-----------------------------------|
| Backend    | Python 3, FastAPI, psycopg2       |
| Frontend   | React + Vite                      |
| Database   | PostgreSQL                        |
| Auth       | Token monouso (tabella `token`)   |

---

## Architettura del sistema

```
┌─────────────────┐        HTTP/JSON        ┌─────────────────┐
│  Frontend       │ ──────────────────────▶ │ FastAPI Backend │
│  React + Vite   │                         │ main.py         │
│  (porta 5173)   │ ◀────────────────────── │ (porta 8000)    │
└─────────────────┘                         └────────┬────────┘
                                                     │ psycopg2
                                            ┌────────▼────────┐
                                            │   PostgreSQL    │
                                            │  captive_portal │
                                            │  (porta 5432)   │
                                            └─────────────────┘
```

Il backend si connette a PostgreSQL usando **ruoli distinti per livello di accesso** (`teacher` e `principal`), impersonando il ruolo dell'utente autenticato per ogni connessione. L'autenticazione avviene esclusivamente tramite token monouso.

---

## Struttura del database

Il database `captive_portal` contiene le seguenti tabelle:

| Tabella         | Descrizione                                                  |
|-----------------|--------------------------------------------------------------|
| `account`       | Anagrafica degli utenti (insegnanti e dirigenti)             |
| `meeting`       | Sedute del collegio docenti                                  |
| `proposal`      | Proposte di voto associate a una seduta                      |
| `token`         | Token monouso per l'autenticazione                           |
| `participation` | Registrazione delle presenze per seduta                      |
| `vote`          | Voti espressi dagli utenti sulle proposte                    |

> **Nota:** la tabella `participation` include una colonna `has_exited` (default `FALSE`) riservata a un futuro flusso di check-out esplicito; non è attualmente utilizzata da nessun endpoint.

### Ruoli PostgreSQL

| Ruolo       | Privilegi                                                                  |
|-------------|----------------------------------------------------------------------------|
| `teacher`   | SELECT su meeting/proposal/account/token; SELECT+INSERT+UPDATE su participation; SELECT+INSERT su vote |
| `principal` | Full privileges su tutte le tabelle e sequenze                             |

### Encoding del voto

| Valore | Significato |
|--------|-------------|
| `0`    | Contrario   |
| `1`    | Astenuto    |
| `2`    | Favorevole  |

Una proposta è **approvata** se ottiene più del 50% di voti favorevoli sul totale dei partecipanti alla seduta (`voti_favorevoli > totale_partecipanti / 2`).

---

## Deploy

### Prerequisiti

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

### 1. Database

```bash
# Crea il database
psql -U postgres -c "CREATE DATABASE captive_portal;"

# Esegui lo schema (crea tabelle, ruoli e seed data)
psql -U postgres -d captive_portal -f schema.sql
```

### 2. Backend

```bash
# Installa le dipendenze
pip install fastapi uvicorn psycopg2-binary

# Avvia il server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

La documentazione interattiva è disponibile su `http://localhost:8000/docs`.

Per modificare l'indirizzo del database, edita queste variabili in `main.py`:

```python
host_ip = "127.0.0.1"   # indirizzo PostgreSQL
port    = 5432           # porta PostgreSQL
```

### 3. Frontend

```bash
cd frontend   # o la directory del progetto React

npm install
npm run dev   # sviluppo: http://localhost:5173
npm run build # build di produzione
```

Assicurarsi che il frontend punti al backend corretto (tipicamente configurato tramite una variabile d'ambiente o un file `.env` con `VITE_API_URL=http://localhost:8000`).

> **Nota:** il backend attualmente non configura `CORSMiddleware`. Prima di collegare il frontend è necessario aggiungerla in `main.py`:
> ```python
> from fastapi.middleware.cors import CORSMiddleware
> app.add_middleware(
>     CORSMiddleware,
>     allow_origins=["http://localhost:5173"],  # adattare al dominio di produzione
>     allow_methods=["*"],
>     allow_headers=["*"],
> )
> ```

### Deploy in produzione (linee guida)

Per un deploy in ambiente scolastico si consiglia:

- Servire il frontend buildato tramite **Nginx** o **Caddy** (semplice server statico)
- Avviare il backend con **Gunicorn** dietro un reverse proxy:
  ```bash
  gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
  ```
- PostgreSQL in ascolto solo su `localhost` (non esposto sulla rete)

---

## Gestione degli account

Non esiste un endpoint per creare account tramite API. Gli account vanno inseriti **direttamente nel database** prima dell'uso (ad esempio tramite il seed in `schema.sql`, oppure manualmente):

```sql
INSERT INTO account (email, user_name, user_surname, user_role, department)
VALUES ('nuovo.docente@school.it', 'Nome', 'Cognome', 'teacher', 'Mathematics');
```

I valori ammessi per `user_role` sono `'teacher'` e `'principal'`. Il campo `department` può essere `NULL` per i dirigenti.

---

## API Reference

### Convenzioni di autenticazione

Tutti gli endpoint richiedono un token valido, passato in modo diverso a seconda dell'endpoint:

| Metodo di invio | Endpoint che lo usano |
|---|---|
| Header `token: <codice>` | `POST /logout`, `POST /meeting`, `PUT /meeting`, `POST /proposal`, `PUT /proposal`, `POST /participation` |
| Header `Authorization: <codice>` | `GET /useremail`, `GET /meeting`, `GET /meeting/{id}/stats`, `GET /meeting/{id}/proposals`, `GET /proposal`, `GET /proposal/{id}`, `GET /proposal/{id}/stats`, `GET /proposal/{id}/votes` |
| Body JSON campo `token` | `POST /login`, `POST /vote` |

### Codici di errore comuni

| Codice | Significato |
|--------|-------------|
| `401`  | Token assente, non valido o scaduto (`NO_AUTH`) |
| `403`  | Operazione riservata al ruolo `principal` (`FORBIDDEN`) |
| `404`  | Risorsa non trovata (`NOT_FOUND`) |
| `500`  | Errore interno del server |

---

### Autenticazione

#### `POST /login`
Autentica l'utente tramite token monouso e registra automaticamente la sua presenza alla seduta associata al token.

**Body:**
```json
{ "token": "TOK-A1B2C3" }
```

**Risposta 200:**
```json
{
  "login_status": "OK",
  "email": "luca.ferrari@school.it",
  "user_role": "teacher"
}
```

**Risposta 401:**
```json
{ "login_status": "NO_AUTH" }
```

---

#### `POST /logout`
Invalida il token impostando `expires_at = NOW()`, impedendo qualsiasi riutilizzo.

**Header:** `token: <codice_token>`

**Risposta 200:**
```json
{ "logout_status": "OK" }
```

**Risposta 401:**
```json
{ "logout_status": "NO_AUTH" }
```

---

#### `GET /useremail`
Restituisce l'email dell'utente associato al token.

**Header:** `Authorization: <codice_token>`

**Risposta 200:**
```json
{ "email": "luca.ferrari@school.it" }
```

**Risposta 401:**
```json
{ "email": "NO_SUCH_USER" }
```

---

### Sedute (Meeting)

#### `GET /meeting`
Restituisce la lista di tutte le sedute. Accessibile a tutti gli utenti autenticati.

**Header:** `Authorization: <token>`

**Risposta 200:**
```json
[
  {
    "id": 1,
    "meeting_date": "2025-01-10",
    "start_time": "09:00:00",
    "end_time": "11:00:00",
    "president_email": "mario.rossi@school.it"
  }
]
```

---

#### `POST /meeting` *(solo principal)*
Crea una nuova seduta.

**Header:** `token: <token>`

**Body:**
```json
{
  "meeting_date": "2025-10-15",
  "start_time": "09:00:00",
  "end_time": "11:00:00",
  "president_email": "mario.rossi@school.it"
}
```

**Risposta 200:** `{ "create_status": "OK" }`

---

#### `PUT /meeting?meeting_id=<id>` *(solo principal)*
Aggiorna tutti i campi di una seduta esistente (aggiornamento completo).

**Header:** `token: <token>`

**Body:** stessa struttura di `POST /meeting`.

**Risposta 200:** `{ "update_status": "OK" }`

**Risposta 404:** `{ "update_status": "NOT_FOUND" }`

---

#### `GET /meeting/{meeting_id}/stats`
Restituisce le statistiche di una seduta.

**Header:** `Authorization: <token>`

**Risposta 200:**
```json
{
  "meeting_id": 1,
  "date": "2025-01-10",
  "start_time": "09:00:00",
  "end_time": "11:00:00",
  "principal_email": "mario.rossi@school.it",
  "number_of_participants": 4
}
```

---

#### `GET /meeting/{meeting_id}/proposals`
Restituisce tutte le proposte di voto associate a una seduta.

**Header:** `Authorization: <token>`

**Risposta 200:** array di oggetti proposal (stessa struttura di `GET /proposal`).

---

### Proposte (Proposal)

#### `GET /proposal`
Restituisce tutte le proposte. Accessibile a tutti gli utenti autenticati.

**Header:** `Authorization: <token>`

**Risposta 200:**
```json
[
  {
    "id": 1,
    "title": "Acquisto lavagne digitali",
    "proposal_description": "Sostituzione dei proiettori con lavagne interattive.",
    "attachment": "offerta_tecnica.pdf",
    "meeting_id": 3
  }
]
```

---

#### `GET /proposal/{proposal_id}`
Restituisce i dettagli di una singola proposta.

**Header:** `Authorization: <token>`

**Risposta 200:** oggetto proposal con chiavi `proposal_id`, `title`, `proposal_description`, `attachment`, `meeting_id`.

**Risposta 404:** `{ "read_status": "NOT_FOUND" }`

---

#### `POST /proposal` *(solo principal)*
Crea una nuova proposta di voto.

**Header:** `token: <token>`

**Body:**
```json
{
  "title": "Acquisto lavagne digitali",
  "proposal_description": "Sostituzione dei proiettori con lavagne interattive.",
  "attachment": "offerta_tecnica.pdf",
  "meeting_id": 3
}
```

Il campo `attachment` è il nome/path del file allegato; passare stringa vuota `""` se assente.

**Risposta 200:** `{ "insert_status": "OK" }`

---

#### `PUT /proposal?proposal_id=<id>` *(solo principal)*
Aggiorna tutti i campi di una proposta esistente (aggiornamento completo).

**Header:** `token: <token>`

**Body:** stessa struttura di `POST /proposal`.

**Risposta 200:** `{ "update_status": "OK" }`

**Risposta 404:** `{ "update_status": "NOT_FOUND" }`

---

#### `GET /proposal/{proposal_id}/stats`
Restituisce il titolo della proposta e il numero di partecipanti alla seduta correlata.

**Header:** `Authorization: <token>`

**Risposta 200:**
```json
{
  "proposal_id": 1,
  "title": "Acquisto lavagne digitali",
  "number_of_participants": 4
}
```

---

#### `GET /proposal/{proposal_id}/votes`
Restituisce tutti i voti espressi per una proposta.

**Header:** `Authorization: <token>`

**Risposta 200:**
```json
[
  { "account_email": "luca.ferrari@school.it", "proposal_id": 1, "preference": 2 },
  { "account_email": "anna.conti@school.it",   "proposal_id": 1, "preference": 0 }
]
```

---

### Voti (Vote)

#### `POST /vote`
Esprime o aggiorna il voto su una proposta. Se l'utente ha già votato, il voto viene sovrascritto (`ON CONFLICT DO UPDATE`). Accessibile a entrambi i ruoli.

**Body:**
```json
{
  "token": "TOK-A1B2C3",
  "account_email": "luca.ferrari@school.it",
  "proposal_id": 1,
  "preference": 2
}
```

`preference`: `0` = contrario, `1` = astenuto, `2` = favorevole.

**Risposta 200:** `{ "vote_status": "OK" }`

---

### Presenze (Participation)

#### `POST /participation`
Registra manualmente la presenza di un utente a una seduta. Accessibile a entrambi i ruoli; è idempotente (un conflitto viene ignorato silenziosamente).

**Header:** `token: <token>`

**Body:**
```json
{
  "meeting_id": 3,
  "user_email": "marco.gallo@school.it"
}
```

**Risposta 200:** `{ "participation_status": "OK" }`

> La presenza viene registrata automaticamente anche al login — questo endpoint è per usi amministrativi o di correzione.

---

## Logging

Ogni operazione significativa viene trascritta in `app.log` nella stessa directory di `main.py`, nel formato:

```
[2025-10-15 09:03:21] LOGIN: user=luca.ferrari@school.it role=teacher
[2025-10-15 09:05:44] VOTE CREATED: user=luca.ferrari@school.it proposal=3 preference=2
[2025-10-15 11:00:02] LOGOUT: user=luca.ferrari@school.it
```

Le operazioni tracciate sono:

| Operazione          | Evento registrato                              |
|---------------------|------------------------------------------------|
| Login riuscito      | `LOGIN: user=... role=...`                     |
| Login fallito       | `LOGIN FAILED: invalid token`                  |
| Logout              | `LOGOUT: user=...`                             |
| Seduta creata       | `MEETING CREATED: date=... president=...`      |
| Seduta modificata   | `MEETING UPDATED: id=... by=...`               |
| Proposta creata     | `PROPOSAL CREATED: title=... meeting=... by=...` |
| Proposta modificata | `PROPOSAL UPDATED: id=... by=...`              |
| Voto espresso       | `VOTE CREATED: user=... proposal=... preference=...` |
| Presenze lette      | `READ MEETINGS: user=... count=...`            |
| Voti letti          | `READ VOTES: proposal=... by=... count=...`    |
| Presenza registrata | `ATTENDANCE MARKED: meeting=... user=... by=...` |

---

## Note di sicurezza

> Queste note descrivono lo stato attuale del progetto (v0.1 scolastico) e i miglioramenti consigliati per il deploy in produzione reale.

- **Le password dei ruoli PostgreSQL** (`teacher` / `principal` = `"praga"`) sono hard-coded in `main.py`. In produzione usare variabili d'ambiente o un secrets manager.
- **CORS non è configurato**: in assenza di `CORSMiddleware`, il browser bloccherà le richieste cross-origin dal frontend. Aggiungere la middleware come indicato nella sezione [Deploy](#deploy) prima di collegare il frontend.
- **I token** sono stringhe arbitrarie senza firma crittografica. In produzione si consiglia l'uso di token firmati (es. HMAC-SHA256) o JWT.
- **HTTPS**: il portale deve essere servito esclusivamente su HTTPS in un contesto di rete scolastica.
- Il campo `attachment` in `proposal` memorizza solo il nome/path del file come stringa — la gestione dell'upload effettivo del file non è implementata in questa versione.
