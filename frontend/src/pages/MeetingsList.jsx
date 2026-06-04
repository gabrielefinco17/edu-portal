import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import t from '../i18n/IT.json';

export default function MeetingsList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSession, setEditingSession] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('cp_user_data'));
    if (!user || user.role !== 'super_user') {
      navigate('/login');
      return;
    }
    fetchSessions();
  }, [navigate]);

  const fetchSessions = async () => {
    setLoading(true);
    const allSessions = await api.getAllSessions();
    setSessions(allSessions);
    setLoading(false);
  };

  const handleEditClick = (session) => {
    if (session.status === 'finished') return;
    setEditingSession(session);
    setEditTitle(session.title);
    setEditDate(session.scheduledAt ? session.scheduledAt.slice(0, 16) : '');
  };

  const handleUpdateSession = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.updateSession(editingSession.id, {
        title: editTitle,
        scheduledAt: new Date(editDate).toISOString(),
        president_email: editingSession.president_email || ''
      });
      setEditingSession(null);
      await fetchSessions();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateIT = (dateStr) => {
    const d = new Date(dateStr);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'var(--success)';
      case 'scheduled': return 'var(--accent)';
      case 'finished': return 'var(--text-secondary)';
      default: return 'var(--text-secondary)';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return t.session.statusActive;
      case 'scheduled': return t.session.statusScheduled;
      case 'finished': return t.session.statusFinished;
      default: return status;
    }
  };

  if (loading) {
    return <div className="container"><p>{t.loading.system}</p></div>;
  }

  return (
    <div className="container" style={{ justifyContent: 'flex-start', paddingTop: '10vh' }}>
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => navigate('/admin')} 
            style={{ width: 'auto', background: 'transparent', padding: '0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
          >
            ← {t.common.admin}
          </button>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>{t.session.meetingsList}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button 
            onClick={() => api.logout()} 
            style={{ width: 'auto', background: 'transparent', padding: '0', fontSize: '0.8rem', color: 'var(--danger)' }}
          >
            {t.common.logout}
          </button>
        </div>
      </div>

      <div className="dashboard-card glass fade-in" style={{ width: '100%', maxWidth: '800px' }}>
        <h1 style={{ marginBottom: '2rem' }}>{t.session.allMeetings}</h1>

        {editingSession && (
          <div className="glass" style={{ padding: '2rem', marginBottom: '3rem', border: '1px solid var(--accent)' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>{t.session.editSession}</h2>
            <form onSubmit={handleUpdateSession}>
              <div className="input-group">
                <label>{t.session.titleLabel}</label>
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)} 
                  required 
                />
              </div>
              <div className="input-group">
                <label>Data e Ora</label>
                <input 
                  type="datetime-local" 
                  value={editDate} 
                  onChange={(e) => setEditDate(e.target.value)} 
                  required 
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? t.common.sending : t.session.updateSession}
                </button>
                <button type="button" className="btn-outline" onClick={() => setEditingSession(null)}>
                  {t.common.cancel}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="sessions-list">
          {sessions.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>{t.dashboard.noSessions}</p>
          ) : (
            sessions.map(s => (
              <div key={s.id} className="glass" style={{ padding: '1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ 
                      fontSize: '0.65rem', 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '1rem', 
                      background: `${getStatusColor(s.status)}20`, 
                      color: getStatusColor(s.status),
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      border: `1px solid ${getStatusColor(s.status)}40`
                    }}>
                      {getStatusText(s.status)}
                    </span>
                    <h3 style={{ fontSize: '1.1rem' }}>{s.title}</h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {s.status === 'finished'
                      ? `${t.session.finishedOn} ${formatDateIT(s.createdAt)}`
                      : `${t.session.scheduledFor} ${formatDateIT(s.scheduledAt)}`
                    }
                  </p>
                  <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.5 }}>
                    {s.forms?.length || 0} {t.poll.publishedListTitle}
                  </p>
                </div>
                
                {s.status !== 'finished' && (
                  <button 
                    onClick={() => handleEditClick(s)}
                    style={{ 
                      width: 'auto', 
                      background: 'rgba(255,255,255,0.05)', 
                      padding: '0.5rem 1rem', 
                      fontSize: '0.8rem', 
                      borderRadius: '0.5rem',
                      color: 'var(--accent)'
                    }}
                  >
                    {t.poll.edit}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
