# Captive Portal — Gestione Collegi Docenti

Sistema web per la gestione digitale delle sedute del collegio docenti scolastico. Permette la registrazione delle presenze tramite token monouso, la votazione su proposte all'ordine del giorno e la consultazione dello storico delle sedute.

Progetto sviluppato dalla classe 5D — Informatica e Telecomunicazioni, dell' ITTS Vito Volterra di San Donà di Piave.

---

## Indice

- [Stack tecnologico](#stack-tecnologico)
- [Architettura del sistema](#architettura-del-sistema)
- [Struttura del database](#struttura-del-database)
- [Deploy](#deploy)
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
│  Frontend        │ ──────────────────────▶ │  FastAPI Backend │
│  React + Vite    │                         │  main.py         │
│  (porta 5173)    │ ◀────────────────────── │  (porta 8000)    │
└─────────────────┘                         └────────┬────────┘
                                                      │ psycopg2
                                             ┌────────▼────────┐
                                             │   PostgreSQL     │
                                             │  captive_portal  │
                                             │  (porta 5432)    │
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

### Ruoli PostgreSQL

| Ruolo       | Privilegi                                                           |
|-------------|---------------------------------------------------------------------|
| `teacher`   | SELECT su meeting/proposal/account/token; INSERT/UPDATE su participation; INSERT su vote |
| `principal` | Full privileges su tutte le tabelle e sequenze                      |

### Encoding del voto

| Valore | Significato |
|--------|-------------|
| `0`    | Contrario   |
| `1`    | Astenuto    |
| `2`    | Favorevole  |

Una proposta è **approvata** se ottiene almeno il 50% + 1 dei voti favorevoli.

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

### Deploy in produzione (linee guida)

Per un deploy in ambiente scolastico si consiglia:

- Servire il frontend buildato tramite **Nginx** o **Caddy** (semplice server statico)
- Avviare il backend con **Gunicorn** dietro un reverse proxy:
  ```bash
  gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
  ```
- PostgreSQL in ascolto solo su `localhost` (non esposto sulla rete)

---

## API Reference

Tutti gli endpoint richiedono autenticazione tramite token, passato:
- nell'header `token` (per `POST /login`, `POST /logout`, `POST /meeting`, ecc.)
- nell'header `Authorization` (per endpoint con metodo GET)
- nel body JSON (per `POST /vote`)

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

**Codici di errore:** `401 NO_AUTH` (token non valido o scaduto)

---

#### `POST /logout`
Invalida il token impostando `expires_at = NOW()`, impedendo qualsiasi riutilizzo.

**Header:** `token: <codice_token>`

**Risposta 200:**
```json
{ "logout_status": "OK" }
```

---

#### `GET /useremail`
Restituisce l'email dell'utente associato al token.

**Header:** `Authorization: <codice_token>`

**Risposta 200:**
```json
{ "email": "luca.ferrari@school.it" }
```

---

### Sedute (Meeting)

#### `GET /meeting`
Restituisce la lista di tutte le sedute. Accessibile a tutti gli utenti autenticati.

**Header:** `Authorization: <token>`

**Risposta 200:** array di oggetti meeting con `id`, `meeting_date`, `start_time`, `end_time`, `president_email`.

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

**Codici di errore:** `401 NO_AUTH`, `403 FORBIDDEN`

---

#### `PUT /meeting?meeting_id=<id>` *(solo principal)*
Aggiorna i dati di una seduta esistente.

---

#### `GET /meeting/{meeting_id}/stats`
Restituisce le statistiche di una seduta: data, orari, email presidente e numero di partecipanti.

---

#### `GET /meeting/{meeting_id}/proposals`
Restituisce tutte le proposte di voto associate a una seduta.

---

### Proposte (Proposal)

#### `GET /proposal`
Restituisce tutte le proposte. Accessibile a tutti gli utenti autenticati.

---

#### `GET /proposal/{proposal_id}`
Restituisce i dettagli di una singola proposta.

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

Il campo `attachment` è il nome/path del file allegato (può essere stringa vuota se assente).

---

#### `PUT /proposal?proposal_id=<id>` *(solo principal)*
Aggiorna una proposta esistente.

---

#### `GET /proposal/{proposal_id}/stats`
Restituisce il titolo della proposta e il numero di partecipanti alla seduta correlata.

---

#### `GET /proposal/{proposal_id}/votes`
Restituisce tutti i voti espressi per una proposta.

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
Esprime o aggiorna il voto su una proposta. Se l'utente ha già votato, il voto viene sovrascritto (`ON CONFLICT DO UPDATE`).

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

---

### Presenze (Participation)

#### `POST /participation`
Registra manualmente la presenza di un utente a una seduta (utile per scenari di provisioning o correzione).

**Header:** `token: <token>`

**Body:**
```json
{
  "meeting_id": 3,
  "user_email": "marco.gallo@school.it"
}
```

> La presenza viene registrata automaticamente anche al login — questo endpoint è per usi amministrativi.

---

## Manuale utente

### Flusso standard per un insegnante (teacher)

1. **Ricezione del token**: prima della seduta, il dirigente/verbalista invia per email istituzionale un token univoco (es. `TOK-A1B2C3`).

2. **Accesso al portale**: aprire il portale nel browser. Nella schermata di login, inserire il token ricevuto e premere **Accedi**.

3. **Registrazione automatica**: il sistema valida il token, verifica che non sia scaduto e registra automaticamente la presenza alla seduta corrente.

4. **Dashboard**: dopo il login viene mostrata la dashboard con:
   - le proposte di voto attive per la seduta corrente
   - lo storico delle sedute passate

5. **Votazione**: per ogni proposta visibile, selezionare la propria posizione:
   - **Favorevole**
   - **Contrario**
   - **Astenuto**
   
   Premere **Vota** per confermare. Il voto può essere modificato fino alla chiusura della seduta.

6. **Storico**: dalla sezione storico è possibile consultare in sola lettura tutte le sedute passate, le proposte discusse e il loro esito.

7. **Logout**: al termine della seduta, cliccare **Esci**. Il token viene immediatamente invalidato e non potrà essere riutilizzato.

---

### Flusso per il dirigente / verbalista (principal)

Il dirigente dispone di tutti i privilegi dell'insegnante più le funzionalità di gestione:

#### Provisioning pre-seduta (importazione token)

Prima di ogni seduta è necessario:

1. Generare i token monouso per ogni partecipante (uno per insegnante).
2. Inserirli nella tabella `token` del database con la corretta associazione `user_email` / `meeting_id` e una scadenza corrispondente alla fine della seduta.
3. Inviare i token a ogni insegnante tramite email istituzionale.

Esempio di inserimento manuale:
```sql
INSERT INTO token (code, generated_at, expires_at, user_email, meeting_id)
VALUES ('TOK-XYZ123', NOW(), '2025-10-15 11:00:00', 'luca.ferrari@school.it', 11);
```

#### Gestione sedute

Dal portale (o tramite API), il dirigente può:

- **Creare una nuova seduta** (`POST /meeting`): specificare data, ora di inizio, ora di fine e email del presidente.
- **Modificare una seduta esistente** (`PUT /meeting?meeting_id=<id>`).
- **Consultare le statistiche** di una seduta: numero di partecipanti, orari, presidente.

#### Gestione proposte

- **Creare una proposta** (`POST /proposal`): inserire titolo, descrizione, eventuale allegato e ID della seduta.
- **Modificare una proposta** (`PUT /proposal?proposal_id=<id>`).
- **Consultare i voti** di una proposta (`GET /proposal/{id}/votes`).

#### Calcolo dell'esito

L'esito di ogni proposta viene calcolato a livello applicativo:

```
voti_favorevoli > (totale_partecipanti / 2)  →  APPROVATA
altrimenti                                   →  RESPINTA
```

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

> Queste note descrivono lo stato attuale del progetto (v0.1 scolastico) e i miglioramenti consigliati per un eventuale deploy in produzione reale.

- **Le password dei ruoli PostgreSQL** (`teacher` / `principal` = `"praga"`) sono hard-coded in `main.py`.
- **I token** sono stringhe arbitrarie senza firma crittografica. In produzione si consiglia l'uso di token firmati (es. HMAC-SHA256) o JWT.
- **CORS**: assicurarsi di configurare `CORSMiddleware` in FastAPI per limitare le origini accettate al solo dominio del frontend.
- **HTTPS**: il portale deve essere servito esclusivamente su HTTPS in un contesto di rete scolastica.
- Il campo `attachment` in `proposal` memorizza solo il nome/path del file come stringa — la gestione dell'upload effettivo del file non è implementata in questa versione.
