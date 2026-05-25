import t from '../i18n/IT.json';

const BASE_URL = '';

// For GET endpoints: backend reads Authorization header raw value via request.headers.get("Authorization")
const getAuthHeaders = () => ({
  'Authorization': localStorage.getItem('cp_token') || ''
});

// For POST/PUT endpoints: backend uses `token: str = Header(...)` (FastAPI header named "token")
const getTokenHeaders = () => ({
  'Content-Type': 'application/json',
  'token': localStorage.getItem('cp_token') || ''
});

const getEmail = () => {
  try {
    const userData = JSON.parse(localStorage.getItem('cp_user_data'));
    return userData ? userData.email : '';
  } catch (e) {
    return '';
  }
};

const getToken = () => localStorage.getItem('cp_token') || '';

// preference integers per schema: 0=against, 1=abstain, 2=in favour
const PREFERENCE_MAP = {
  [t.vote.favorevole]: 2,
  [t.vote.nonFavorevole]: 0,
  [t.vote.astenuto]: 1
};

// Maps preference integers back to vote option strings
const PREFERENCE_KEYS = [t.vote.nonFavorevole, t.vote.astenuto, t.vote.favorevole];

export const api = {
  async login(rawToken) {
    const cleanToken = rawToken ? rawToken.trim() : '';
    if (!cleanToken) throw new Error(t.api.tokenRequired);

    const response = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cleanToken })
    });

    if (!response.ok) throw new Error(t.api.tokenInvalid);

    const data = await response.json();
    if (data.login_status === 'OK') {
      const sessionUser = {
        token: cleanToken,
        role: data.user_role === 'principal' ? 'super_user' : 'user',
        email: data.email
      };
      localStorage.setItem('cp_token', cleanToken);
      localStorage.setItem('cp_user_data', JSON.stringify(sessionUser));
      return sessionUser;
    } else {
      throw new Error(t.api.tokenInvalid);
    }
  },

  async createSession(title, scheduledDate = null) {
    const dateObj = scheduledDate ? new Date(scheduledDate) : new Date();

    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const meeting_date = `${yyyy}-${mm}-${dd}`;

    const hh = String(dateObj.getHours()).padStart(2, '0');
    const min = String(dateObj.getMinutes()).padStart(2, '0');
    const start_time = `${hh}:${min}:00`;

    const response = await fetch(`${BASE_URL}/meeting`, {
      method: 'POST',
      headers: getTokenHeaders(),
      body: JSON.stringify({
        meeting_date,
        start_time,
        president_email: getEmail()
      })
    });

    if (!response.ok) throw new Error(t.session.createError);

    const data = await response.json();
    if (data.create_status !== 'OK') throw new Error(data.error || 'Access Denied');

    // Fetch real DB-assigned ID
    const sessions = await this.getAllSessions();
    const created = sessions[0];
    if (created) return created;

    return {
      id: null,
      title: `Collegio Docenti - ${meeting_date}`,
      date: meeting_date,
      createdAt: `${meeting_date}T${start_time}`,
      scheduledAt: `${meeting_date}T${start_time}`,
      status: 'active',
      president_email: getEmail()
    };
  },

  async endSession(sessionId) {
    // Fetch current meeting data to preserve all fields when updating
    const sessions = await this.getAllSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error('Session not found');

    const now = new Date();
    const end_time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const start_time = session.createdAt.split('T')[1]?.slice(0, 8) || '00:00:00';

    const response = await fetch(`${BASE_URL}/meeting?meeting_id=${sessionId}`, {
      method: 'PUT',
      headers: getTokenHeaders(),
      body: JSON.stringify({
        meeting_date: session.date,
        start_time,
        end_time,
        president_email: session.president_email || getEmail()
      })
    });

    if (!response.ok) throw new Error(t.session.endError || 'Errore nella chiusura della seduta');
    const data = await response.json();
    if (data.update_status !== 'OK') throw new Error(data.error || 'Access Denied');
    return { success: true };
  },

  async updateSession(sessionId, updates) {
    const dateObj = new Date(updates.scheduledAt);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const meeting_date = `${yyyy}-${mm}-${dd}`;

    const hh = String(dateObj.getHours()).padStart(2, '0');
    const min = String(dateObj.getMinutes()).padStart(2, '0');
    const start_time = `${hh}:${min}:00`;

    const response = await fetch(`${BASE_URL}/meeting?meeting_id=${sessionId}`, {
      method: 'PUT',
      headers: getTokenHeaders(),
      body: JSON.stringify({
        meeting_date,
        start_time,
        president_email: updates.president_email || null
      })
    });

    if (!response.ok) throw new Error('Errore nell\'aggiornamento della seduta');

    const data = await response.json();
    if (data.update_status !== 'OK') throw new Error(data.error || 'Access Denied');

    return { id: sessionId, ...updates };
  },

  async getActiveSession() {
    const sessions = await this.getAllSessions();
    return sessions.find(s => s.status === 'active') || null;
  },

  async getAllSessions() {
    const token = getToken();
    if (!token) return [];

    const response = await fetch(`${BASE_URL}/meeting`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (data.read_status === 'NO_AUTH' || !Array.isArray(data)) return [];

    return data.map(meeting => ({
      id: meeting.id,
      title: `Collegio Docenti - ${meeting.meeting_date}`,
      date: meeting.meeting_date,
      createdAt: `${meeting.meeting_date}T${meeting.start_time}`,
      scheduledAt: `${meeting.meeting_date}T${meeting.start_time}`,
      status: (meeting.end_time && meeting.end_time !== 'None') ? 'finished' : 'active',
      president_email: meeting.president_email,
      presenti: meeting.participant_count || 0
    })).sort((a, b) => b.id - a.id);
  },

  async publishForm(title, content) {
    const session = await this.getActiveSession();
    if (!session) throw new Error('No active meeting session');

    const response = await fetch(`${BASE_URL}/proposal`, {
      method: 'POST',
      headers: getTokenHeaders(),
      body: JSON.stringify({
        title,
        proposal_description: content,
        attachment: '',
        meeting_id: Number(session.id)
      })
    });

    if (!response.ok) throw new Error(t.poll.publishError);

    const data = await response.json();
    if (data.insert_status !== 'OK') throw new Error(data.error || 'Access Denied');

    return { id: Date.now(), title, content };
  },

  async updateForm(formId, title, content) {
    const session = await this.getActiveSession();
    if (!session) throw new Error('No active meeting session');

    const response = await fetch(`${BASE_URL}/proposal?proposal_id=${formId}`, {
      method: 'PUT',
      headers: getTokenHeaders(),
      body: JSON.stringify({
        title,
        proposal_description: content,
        attachment: '',
        meeting_id: Number(session.id)
      })
    });

    if (!response.ok) throw new Error(t.poll.updateError);

    const data = await response.json();
    if (data.update_status !== 'OK') throw new Error(data.error || 'Access Denied');

    return { id: formId, title, content };
  },

  async getForms() {
    const session = await this.getActiveSession();
    if (!session) return [];
    return this.getFormsBySession(session.id);
  },

  async getFormsBySession(sessionId) {
    if (!getToken()) return [];

    const response = await fetch(`${BASE_URL}/meeting/${sessionId}/proposals`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (data.read_status === 'NO_AUTH') return [];

    return data.map(p => ({
      id: p.id,
      title: p.title,
      content: p.proposal_description,
      meeting_id: p.meeting_id
    }));
  },

  async submitVote(formId, option) {
    const prefIndex = PREFERENCE_MAP[option];
    if (prefIndex === undefined) throw new Error('Opzione di voto non valida');

    const response = await fetch(`${BASE_URL}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: getToken(),
        account_email: getEmail(),
        proposal_id: Number(formId),
        preference: prefIndex
      })
    });

    if (!response.ok) throw new Error(t.vote.error);
    const data = await response.json();
    if (data.vote_status !== 'OK') throw new Error(data.error || 'Access Denied');
    return { success: true, message: t.api.voteSuccess };
  },

  async getVoteStats(formId) {
    const response = await fetch(`${BASE_URL}/proposal/${formId}/votes`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) return { favorevole: 0, 'non favorevole': 0, astenuto: 0 };

    const data = await response.json();
    if (!Array.isArray(data)) return { favorevole: 0, 'non favorevole': 0, astenuto: 0 };

    const counts = { favorevole: 0, 'non favorevole': 0, astenuto: 0 };
    for (const vote of data) {
      const key = PREFERENCE_KEYS[vote.preference];
      if (key !== undefined) counts[key]++;
    }
    return counts;
  },

  async getBulkVoteStats(formIds) {
    const results = {};
    await Promise.all(
      formIds.map(async (id) => {
        results[id] = await this.getVoteStats(id);
      })
    );
    return results;
  },

  async setAttendanceStatus(sessionId, status) {
    const body = JSON.stringify({ meeting_id: Number(sessionId), user_email: getEmail() });

    if (status === 'present') {
      const response = await fetch(`${BASE_URL}/participation`, {
        method: 'POST',
        headers: getTokenHeaders(),
        body
      });
      if (!response.ok) throw new Error("Errore nell'aggiornamento della presenza");
      const data = await response.json();
      if (data.participation_status !== 'OK') throw new Error(data.error || 'Access Denied');
    } else if (status === 'exited') {
      const response = await fetch(`${BASE_URL}/participation`, {
        method: 'PUT',
        headers: getTokenHeaders(),
        body
      });
      if (!response.ok) throw new Error("Errore nell'aggiornamento della presenza");
      const data = await response.json();
      if (data.exit_status !== 'OK') throw new Error(data.error || 'Access Denied');
    }

    return { success: true, message: t.api.presenceSuccess };
  },

  async getUserAttendance(sessionId) {
    const email = getEmail();
    if (!email) return { isPresent: false, hasExited: false };

    const response = await fetch(
      `${BASE_URL}/participation?meeting_id=${sessionId}&user_email=${encodeURIComponent(email)}`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) return { isPresent: false, hasExited: false };

    const data = await response.json();
    return {
      isPresent: data.is_present || false,
      hasExited: data.has_exited || false
    };
  },

  async getPresenceStats(sessionId) {
    const response = await fetch(`${BASE_URL}/meeting/${sessionId}/stats`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) return { secondi: 0, presenti: 0 };

    const data = await response.json();
    if (data && data.number_of_participants !== undefined) {
      return { presenti: data.number_of_participants || 0 };
    }
    return { secondi: 0, presenti: 0 };
  },

  logout() {
    const token = localStorage.getItem('cp_token');
    if (token) {
      fetch(`${BASE_URL}/logout`, {
        method: 'POST',
        headers: { 'token': token }
      }).catch(err => console.error('Logout error:', err));
    }
    localStorage.removeItem('cp_token');
    localStorage.removeItem('cp_user_data');
    localStorage.removeItem('cp_user_votes');
    window.location.href = '/';
  }
};
