from typing import Literal, Optional
from datetime import datetime
import os
import psycopg2
from fastapi import FastAPI, Request, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


# -----------------------------------------------------------
# MODELS
# -----------------------------------------------------------

class LoginRequest(BaseModel):
    token: str = Field(..., min_length=1)


class UserCreate(BaseModel):
    token: str = Field(..., min_length=1)
    email: str = Field(..., min_length=7)
    user_name: str = Field(..., min_length=1)
    user_surname: str = Field(..., min_length=1)
    user_role: Literal["teacher", "principal"]
    user_department: str = Field(..., min_length=1)


class UserRead(BaseModel):
    email: str
    user_name: str
    user_surname: str
    user_role: str
    user_department: str


class MeetingCreate(BaseModel):
    meeting_date: str = Field(..., min_length=10)
    start_time: str = Field(..., min_length=8)
    end_time: Optional[str] = Field(default=None, min_length=8)
    president_email: str = Field(..., max_length=40)


class MeetingUpdate(BaseModel):
    meeting_date: Optional[str] = Field(default=None, min_length=10)
    start_time: Optional[str] = Field(default=None, min_length=8)
    end_time: Optional[str] = Field(default=None, min_length=8)
    president_email: Optional[str] = Field(default=None, max_length=40)


class ProposalCreate(BaseModel):
    title: str = Field(..., min_length=1)
    proposal_description: str = Field(..., min_length=1)
    attachment: str
    meeting_id: int = Field(..., gt=0)


class ProposalUpdate(BaseModel):
    title: str = Field(min_length=1)
    proposal_description: str = Field(min_length=1)
    attachment: str
    meeting_id: int = Field(gt=0)


class VoteCreate(BaseModel):
    token: str = Field(..., min_length=1)
    account_email: str = Field(..., min_length=1, max_length=40)
    proposal_id: int = Field(..., gt=0)
    preference: Literal[0, 1, 2]


class VoteRead(BaseModel):
    account_email: str
    proposal_id: int
    preference: int


class ParticipationCreate(BaseModel):
    meeting_id: int = Field(..., gt=0)
    user_email: str = Field(..., min_length=1, max_length=40)


# -----------------------------------------------------------
# CONFIG
# -----------------------------------------------------------

teacher_pass = "praga"
principal_pass = "praga"
host_ip = os.environ.get("DB_HOST", "127.0.0.1")
port = 5432


def get_password(role: str) -> str:
    return principal_pass if role == "principal" else teacher_pass


# -----------------------------------------------------------
# LOGGING
# -----------------------------------------------------------

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.log")


def log_action(action: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {action}\n"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass


# -----------------------------------------------------------
# ENDPOINTS
# -----------------------------------------------------------

app = FastAPI(title="Captive Portal 5D")


# ---- AUTH ----

@app.post("/login")
def login(request: LoginRequest):
    conn = None
    cursor = None
    try:
        user = check_token(request.token)
        if user:
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port,
                connect_timeout=5
            )
            cursor = conn.cursor()
            cursor.execute(
                """
                    INSERT INTO participation(meeting_id, user_email)
                    SELECT meeting_id, user_email
                    FROM token
                    WHERE code = %s
                    ON CONFLICT DO NOTHING
                """,
                [request.token]
            )
            cursor.connection.commit()
            log_action(f"LOGIN: user={user[0]} role={user[1]}")
            return {
                "login_status": "OK",
                "email": user[0],
                "user_role": user[1]
            }
        else:
            log_action(f"LOGIN FAILED: invalid token")
            return JSONResponse(status_code=401, content={"login_status": "NO_AUTH"})
    except Exception as e:
        if cursor:
            cursor.connection.rollback()
        return JSONResponse(status_code=500, content={"error": f"Internal server error: {str(e)}"})
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.post("/logout")
def logout(token: str = Header(...)):
    conn = None
    cursor = None
    try:
        user = check_token(token)
        if user:
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port
            )
            cursor = conn.cursor()
            cursor.execute(
                """
                    UPDATE token
                    SET expires_at = NOW()
                    WHERE code = %s
                """,
                [token]
            )
            cursor.connection.commit()
            log_action(f"LOGOUT: user={user[0]}")
            return {"logout_status": "OK"}
        else:
            return JSONResponse(status_code=401, content={"logout_status": "NO_AUTH"})
    except Exception:
        if cursor:
            cursor.connection.rollback()
        return JSONResponse(status_code=500, content={"error": "Internal server error"})
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ---- USER ----

@app.get("/useremail")
def get_email(request: Request):
    usr = check_token(request.headers.get("Authorization"))
    if usr:
        return {"email": usr[0]}
    else:
        return JSONResponse(status_code=401, content={"email": "NO_SUCH_USER"})


# ---- MEETING ----

@app.post("/meeting")
def create_meeting(request: MeetingCreate, token: str = Header(...)):
    conn = None
    cursor = None
    user = check_token(token)
    if user:
        if user[1] == "principal":
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port
            )
            cursor = conn.cursor()
            try:
                cursor.execute(
                    """
                        INSERT INTO meeting(
                            meeting_date,
                            start_time,
                            end_time,
                            president_email
                        )
                        VALUES (%s, %s, %s, %s)
                    """,
                    [
                        request.meeting_date,
                        request.start_time,
                        request.end_time,
                        request.president_email,
                    ]
                )
                cursor.connection.commit()
                log_action(f"MEETING CREATED: date={request.meeting_date} president={request.president_email}")
                return {"create_status": "OK"}
            except Exception:
                cursor.connection.rollback()
                return JSONResponse(status_code=500, content={"error": "Internal server error"})
            finally:
                cursor.close()
                conn.close()
        else:
            return JSONResponse(status_code=403, content={"create_status": "FORBIDDEN"})
    else:
        return JSONResponse(status_code=401, content={"create_status": "NO_AUTH"})
    

@app.get("/meeting")
def read_all_meetings(request: Request):
    conn = None
    cursor = None
    try:
        user = check_token(request.headers.get("Authorization"))
        if user:
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port
            )
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM meeting")
            list_tup = cursor.fetchall()
            for i in range(len(list_tup)):
                list_tup[i] = {
                    "id": list_tup[i][0],
                    "meeting_date": str(list_tup[i][1]),
                    "start_time": str(list_tup[i][2]),
                    "end_time": str(list_tup[i][3]),
                    "president_email": list_tup[i][4],
                }
            log_action(f"READ MEETINGS: user={user[0]} count={len(list_tup)}")
            return list_tup
        else:
            return JSONResponse(status_code=401, content={"read_status": "NO_AUTH"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Internal server error: {str(e)}"})
    finally:
        if cursor: 
            cursor.close()
        if conn: 
            conn.close()


@app.put("/meeting")
def update_meeting(request: MeetingUpdate, meeting_id: int, token: str = Header(...)):
    conn = None
    cursor = None
    user = check_token(token)
    if user:
        if user[1] == "principal":
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port
            )
            cursor = conn.cursor()
            try:
                cursor.execute(
                    """
                        UPDATE meeting
                        SET meeting_date = %s,
                            start_time = %s,
                            end_time = %s,
                            president_email = %s
                        WHERE id = %s
                    """,
                    [
                        request.meeting_date,
                        request.start_time,
                        request.end_time,
                        request.president_email,
                        meeting_id,
                    ]
                )
                if cursor.rowcount == 0:
                    cursor.connection.rollback()
                    return JSONResponse(status_code=404, content={"update_status": "NOT_FOUND"})
                cursor.connection.commit()
                log_action(f"MEETING UPDATED: id={meeting_id} by={user[0]}")
                return {"update_status": "OK"}
            except Exception:
                cursor.connection.rollback()
                return JSONResponse(status_code=500, content={"error": "Internal server error"})
            finally:
                cursor.close()
                conn.close()
        else:
            return JSONResponse(status_code=403, content={"update_status": "FORBIDDEN"})
    else:
        return JSONResponse(status_code=401, content={"update_status": "NO_AUTH"})


@app.get("/meeting/{meeting_id}/stats")
def meetings_stats(meeting_id: int, request: Request):
    conn = None
    cursor = None
    try:
        user = check_token(request.headers.get("Authorization"))
        if user:
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port
            )
            cursor = conn.cursor()
            cursor.execute(
                """
                    SELECT m.id, m.meeting_date, m.start_time, m.end_time, m.president_email,
                           COUNT(p.user_email) AS participant_count
                    FROM meeting m
                    LEFT JOIN participation p ON m.id = p.meeting_id
                    WHERE m.id = %s
                    GROUP BY m.id
                """,
                [meeting_id]
            )
            result = cursor.fetchone()
            result_dict = {
                'meeting_id' : result[0],
                'date' : result[1],
                'start_time' : result[2],
                'end_time' : result[3],
                'principal_email' : result[4],
                'number_of_participants' : result[5]
            }
            return result_dict
        else:
            return JSONResponse(status_code=401, content={"read_status": "NO_AUTH"})
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Internal server error"})
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/meeting/{meeting_id}/proposals")
def meeting_proposals(meeting_id: int, request: Request):
    conn = None
    cursor = None
    try:
        user = check_token(request.headers.get("Authorization"))
        if user:
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port
            )
            cursor = conn.cursor()
            cursor.execute(
                """
                    SELECT p.id, p.title, p.proposal_description, p.attachment, p.meeting_id
                    FROM proposal AS p
                    INNER JOIN meeting AS m ON p.meeting_id = m.id
                    WHERE m.id = %s
                """,
                [meeting_id]
            )
            list_tup = cursor.fetchall()
            for i in range(len(list_tup)):
                list_tup[i] = {
                    "id": list_tup[i][0],
                    "title": list_tup[i][1],
                    "proposal_description": list_tup[i][2],
                    "attachment": list_tup[i][3],
                    "meeting_id": list_tup[i][4],
                }
            return list_tup
        else:
            return JSONResponse(status_code=401, content={"read_status": "NO_AUTH"})
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Internal server error"})
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ---- PROPOSAL ----

@app.post("/proposal")
def create_proposal(request: ProposalCreate, token: str = Header(...)):
    conn = None
    cursor = None
    user = check_token(token)
    if user:
        if user[1] == "principal":
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port
            )
            cursor = conn.cursor()
            try:
                cursor.execute(
                    """
                        INSERT INTO proposal(
                            title,
                            proposal_description,
                            attachment,
                            meeting_id
                        )
                        VALUES (%s, %s, %s, %s)
                    """,
                    [
                        request.title,
                        request.proposal_description,
                        request.attachment,
                        request.meeting_id,
                    ]
                )
                cursor.connection.commit()
                log_action(f"PROPOSAL CREATED: title={request.title} meeting={request.meeting_id} by={user[0]}")
                return {"insert_status": "OK"}
            except Exception:
                cursor.connection.rollback()
                return JSONResponse(status_code=500, content={"error": "Internal server error"})
            finally:
                cursor.close()
                conn.close()
        else:
            return JSONResponse(status_code=403, content={"insert_status": "FORBIDDEN"})
    else:
        return JSONResponse(status_code=401, content={"insert_status": "NO_AUTH"})


@app.get("/proposal")
def read_all_proposals(request: Request):
    conn = None
    cursor = None
    try:
        user = check_token(request.headers.get("Authorization"))
        if user:
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port
            )
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM proposal")
            list_tup = cursor.fetchall()
            for i in range(len(list_tup)):
                list_tup[i] = {
                    "id": list_tup[i][0],
                    "title": list_tup[i][1],
                    "proposal_description": list_tup[i][2],
                    "attachment": list_tup[i][3],
                    "meeting_id": list_tup[i][4],
                }
            return list_tup
        else:
            return JSONResponse(status_code=401, content={"read_status": "NO_AUTH"})
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Internal server error"})
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/proposal/{proposal_id}")
def read_proposal(proposal_id: int, request: Request):
    conn = None
    cursor = None
    try:
        user = check_token(request.headers.get("Authorization"))
        if user:
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port
            )
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM proposal WHERE id = %s",
                [proposal_id]
            )
            row = cursor.fetchone()
            if row is None:
                return JSONResponse(status_code=404, content={"read_status": "NOT_FOUND"})
            return {
                "proposal_id": row[0],
                "title": row[1],
                "proposal_description": row[2],
                "attachment": row[3],
                "meeting_id": row[4],
            }
        else:
            return JSONResponse(status_code=401, content={"read_status": "NO_AUTH"})
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Internal server error"})
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.put("/proposal")
def update_proposal(request: ProposalUpdate, proposal_id: int, token: str = Header(...)):
    conn = None
    cursor = None
    user = check_token(token)
    if user:
        if user[1] == "principal":
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port
            )
            cursor = conn.cursor()
            try:
                cursor.execute(
                    """
                        UPDATE proposal
                        SET title = %s,
                            proposal_description = %s,
                            attachment = %s,
                            meeting_id = %s
                        WHERE id = %s
                    """,
                    [
                        request.title,
                        request.proposal_description,
                        request.attachment,
                        request.meeting_id,
                        proposal_id,
                    ]
                )
                if cursor.rowcount == 0:
                    cursor.connection.rollback()
                    return JSONResponse(status_code=404, content={"update_status": "NOT_FOUND"})
                cursor.connection.commit()
                log_action(f"PROPOSAL UPDATED: id={proposal_id} by={user[0]}")
                return {"update_status": "OK"}
            except Exception:
                cursor.connection.rollback()
                return JSONResponse(status_code=500, content={"error": "Internal server error"})
            finally:
                cursor.close()
                conn.close()
        else:
            return JSONResponse(status_code=403, content={"update_status": "FORBIDDEN"})
    else:
        return JSONResponse(status_code=401, content={"update_status": "NO_AUTH"})


@app.get("/proposal/{proposal_id}/stats")
def proposals_stats(proposal_id: int, request: Request):
    conn = None
    cursor = None
    try:
        user = check_token(request.headers.get("Authorization"))
        if user:
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port
            )
            cursor = conn.cursor()
            cursor.execute(
                """
                    SELECT p.id, p.title,
                           COUNT(pa.user_email) AS participant_count
                    FROM proposal p
                    LEFT JOIN meeting m ON p.meeting_id = m.id
                    LEFT JOIN participation pa ON m.id = pa.meeting_id
                    WHERE p.id = %s
                    GROUP BY p.id, p.title
                """,
                [proposal_id]
            )
            result = cursor.fetchone()
            result_dict = {
                'proposal_id' : result[0],
                'title' : result[1],
                'number_of_participants' : result[2]
            }
            return result_dict
        else:
            return JSONResponse(status_code=401, content={"read_status": "NO_AUTH"})
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Internal server error"})
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/proposal/{proposal_id}/votes")
def read_proposal_votes(proposal_id: int, request: Request):
    conn = None
    cursor = None
    try:
        user = check_token(request.headers.get("Authorization"))
        if user:
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port
            )
            cursor = conn.cursor()
            cursor.execute(
                """
                    SELECT account_email, proposal_id, preference
                    FROM vote
                    WHERE proposal_id = %s
                """,
                [proposal_id]
            )
            list_tup = cursor.fetchall()
            for i in range(len(list_tup)):
                list_tup[i] = {
                    "account_email": list_tup[i][0],
                    "proposal_id": list_tup[i][1],
                    "preference": list_tup[i][2],
                }
            log_action(f"READ VOTES: proposal={proposal_id} by={user[0]} count={len(list_tup)}")
            return list_tup
        else:
            return JSONResponse(status_code=401, content={"read_status": "NO_AUTH"})
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Internal server error"})
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ---- VOTE ----

@app.post("/vote")
def create_vote(request: VoteCreate):
    conn = None
    cursor = None
    user = check_token(request.token)
    if user:
        conn = psycopg2.connect(
            database="captive_portal_db",
            user=user[1],
            password=get_password(user[1]),
            host=host_ip,
            port=port
        )
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                    INSERT INTO vote(account_email, proposal_id, preference)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (account_email, proposal_id)
                    DO NOTHING
                """,
                [request.account_email, request.proposal_id, request.preference]
            )
            cursor.connection.commit()
            log_action(f"VOTE CREATED: user={request.account_email} proposal={request.proposal_id} preference={request.preference}")
            return {"vote_status": "OK"}
        except Exception:
            cursor.connection.rollback()
            return JSONResponse(status_code=500, content={"error": "Internal server error"})
        finally:
            cursor.close()
            conn.close()
    else:
        return JSONResponse(status_code=401, content={"vote_status": "NO_AUTH"})


# ---- PARTICIPATION ----

@app.post("/participation")
def mark_attendance(request: ParticipationCreate, token: str = Header(...)):
    conn = None
    cursor = None
    user = check_token(token)
    if user:
        conn = psycopg2.connect(
            database="captive_portal_db",
            user=user[1],
            password=get_password(user[1]),
            host=host_ip,
            port=port
        )
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                    INSERT INTO participation(meeting_id, user_email)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                """,
                [request.meeting_id, request.user_email]
            )
            cursor.connection.commit()
            log_action(f"ATTENDANCE MARKED: meeting={request.meeting_id} user={request.user_email} by={user[0]}")
            return {"participation_status": "OK"}
        except Exception:
            cursor.connection.rollback()
            return JSONResponse(status_code=500, content={"error": "Internal server error"})
        finally:
            cursor.close()
            conn.close()
    else:
        return JSONResponse(status_code=401, content={"participation_status": "NO_AUTH"})


@app.get("/participation")
def get_participation(meeting_id: int, user_email: str, request: Request):
    conn = None
    cursor = None
    try:
        user = check_token(request.headers.get("Authorization"))
        if user:
            conn = psycopg2.connect(
                database="captive_portal_db",
                user=user[1],
                password=get_password(user[1]),
                host=host_ip,
                port=port
            )
            cursor = conn.cursor()
            cursor.execute(
                """
                    SELECT has_exited FROM participation
                    WHERE meeting_id = %s AND user_email = %s
                """,
                [meeting_id, user_email]
            )
            row = cursor.fetchone()
            if row is None:
                return {"is_present": False, "has_exited": False}
            return {"is_present": True, "has_exited": bool(row[0])}
        else:
            return JSONResponse(status_code=401, content={"error": "NO_AUTH"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Internal server error: {str(e)}"})
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.put("/participation")
def exit_participation(request: ParticipationCreate, token: str = Header(...)):
    conn = None
    cursor = None
    user = check_token(token)
    if user:
        conn = psycopg2.connect(
            database="captive_portal_db",
            user=user[1],
            password=get_password(user[1]),
            host=host_ip,
            port=port
        )
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                    UPDATE participation
                    SET has_exited = TRUE
                    WHERE meeting_id = %s AND user_email = %s
                """,
                [request.meeting_id, request.user_email]
            )
            if cursor.rowcount == 0:
                cursor.connection.rollback()
                return JSONResponse(status_code=404, content={"exit_status": "NOT_FOUND"})
            cursor.connection.commit()
            log_action(f"EXIT MARKED: meeting={request.meeting_id} user={request.user_email} by={user[0]}")
            return {"exit_status": "OK"}
        except Exception:
            cursor.connection.rollback()
            return JSONResponse(status_code=500, content={"error": "Internal server error"})
        finally:
            cursor.close()
            conn.close()
    else:
        return JSONResponse(status_code=401, content={"exit_status": "NO_AUTH"})


# -----------------------------------------------------------
# UTILITIES
# -----------------------------------------------------------

def check_token(tok: str):
    conn = None
    cursor = None
    try:
        conn = psycopg2.connect(
            database="captive_portal_db",
            user="principal",
            password=principal_pass,
            host=host_ip,
            port=port,
            connect_timeout=5
        )
        cursor = conn.cursor()
        cursor.execute(
            """
                SELECT account.email, account.user_role, token.code
                FROM token
                INNER JOIN account ON account.email = token.user_email
                WHERE token.code = %s
                AND token.expires_at > NOW()
            """,
            [tok]
        )
        return cursor.fetchone()
    except Exception as e:
        print(f"check_token FAILED: {type(e).__name__}: {e}")
        if cursor:
            cursor.connection.rollback()
        return None
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
