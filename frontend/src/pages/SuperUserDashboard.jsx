import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import t from '../i18n/IT.json';

export default function SuperUserDashboard() {
  const [session, setSession] = useState(null);
  const [forms, setForms] = useState([]);
  const [showPollForm, setShowPollForm] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [pollTitle, setPollTitle] = useState('');
  const [pollContent, setPollContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingFormId, setEditingFormId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('cp_user_data'));
    if (!user || user.role !== 'super_user') {
      navigate('/login');
      return;
    }
    init();
  }, [navigate]);

  const init = async () => {
    setLoading(true);
    const activeSession = await api.getActiveSession();
    setSession(activeSession);
    if (activeSession) {
      const activeForms = await api.getForms();
      setForms(activeForms);
    }
    setLoading(false);
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (sessionDate && new Date(sessionDate) < new Date()) {
      setMessage({ type: 'error', text: 'Non è possibile creare una seduta in una data e ora passate.' });
      return;
    }
    setActionLoading(true);
    try {
      const newSession = await api.createSession(sessionTitle, sessionDate || null);
      setSession(newSession);
      setForms([]);
      setMessage({ type: 'success', text: t.session.createdSuccess });
    } catch (err) {
      setMessage({ type: 'error', text: t.session.createError });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishPoll = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (editingFormId) {
        await api.updateForm(editingFormId, pollTitle, pollContent);
        setMessage({ type: 'success', text: t.poll.updateSuccess });
      } else {
        await api.publishForm(pollTitle, pollContent);
        setMessage({ type: 'success', text: t.poll.publishedSuccess });
      }
      
      setPollTitle('');
      setPollContent('');
      setEditingFormId(null);
      setShowPollForm(false);
      const updatedForms = await api.getForms();
      setForms(updatedForms);
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: editingFormId ? t.poll.updateError : t.poll.publishError 
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditForm = (form) => {
    setEditingFormId(form.id);
    setPollTitle(form.title);
    setPollContent(form.content);
    setShowPollForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingFormId(null);
    setPollTitle('');
    setPollContent('');
    setShowPollForm(false);
  };

  if (loading) {
    return <div className="container"><p>{t.loading.system}</p></div>;
  }

  return (
    <div className="container" style={{ justifyContent: 'flex-start', paddingTop: '10vh' }}>
      <div className="top-bar">
        <span>{t.common.admin}</span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button 
            onClick={() => navigate('/')} 
            style={{ width: 'auto', background: 'transparent', padding: '0 1rem', fontSize: '0.8rem', color: 'var(--accent)' }}
          >
            Risultati
          </button>
          <button 
            onClick={() => navigate('/admin/meetings')} 
            style={{ width: 'auto', background: 'transparent', padding: '0 1rem', fontSize: '0.8rem', color: 'var(--accent)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}
          >
            {t.session.meetingsList}
          </button>
          <button 
            onClick={() => navigate('/user')} 
            style={{ width: 'auto', background: 'transparent', padding: '0 1rem', fontSize: '0.8rem', color: 'var(--accent)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}
          >
            {t.login.goToVote}
          </button>
          <button 
            onClick={() => api.logout()} 
            style={{ width: 'auto', background: 'transparent', padding: '0 0 0 1rem', fontSize: '0.8rem', color: 'var(--danger)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}
          >
            {t.common.logout}
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`message-banner ${message.type}`} style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
          backgroundColor: message.type === 'success' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
          color: message.type === 'success' ? '#2ecc71' : '#e74c3c',
          border: `1px solid ${message.type === 'success' ? 'rgba(46, 204, 113, 0.3)' : 'rgba(231, 76, 60, 0.3)'}`,
          width: '100%',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}>
          {message.text}
        </div>
      )}

      <div className="dashboard-card glass fade-in">
        {!session ? (
          <div className="fade-in">
            <h1 style={{ marginBottom: '1.5rem' }}>{t.session.newTitle}</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              {t.session.newDescription}
            </p>
            <form onSubmit={handleCreateSession}>
              <div className="input-group">
                <label htmlFor="sessionTitle">{t.session.titleLabel}</label>
                <input
                  id="sessionTitle"
                  type="text"
                  placeholder={t.session.titlePlaceholder}
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label htmlFor="sessionDate">Data e Ora (opzionale)</label>
                <input
                  id="sessionDate"
                  type="datetime-local"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  min={(() => { const n = new Date(); const p = x => String(x).padStart(2,'0'); return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}`; })()}
                />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Lascia vuoto per iniziare subito la seduta.</p>
              </div>
              <button type="submit" className="btn-primary" disabled={actionLoading}>
                {actionLoading ? t.session.creating : t.session.create}
              </button>
            </form>
          </div>
        ) : (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase' }}>
                  {t.session.activeLabel}
                </span>
                <h1 style={{ marginTop: '0.25rem' }}>{session.title}</h1>
              </div>
              <button 
                className="btn-primary" 
                style={{ width: '3rem', height: '3rem', borderRadius: '50%', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}
                onClick={() => {
                  if (showPollForm && editingFormId) {
                    handleCancelEdit();
                  } else {
                    setShowPollForm(!showPollForm);
                    if (!showPollForm) {
                      setEditingFormId(null);
                      setPollTitle('');
                      setPollContent('');
                    }
                  }
                }}
              >
                {showPollForm ? '×' : '+'}
              </button>
            </div>

            {showPollForm && (
              <form onSubmit={handlePublishPoll} className="fade-in" style={{ marginBottom: '3rem', padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '1rem', border: '1px solid var(--glass-border)' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>
                  {editingFormId ? t.poll.editTitle : t.poll.newTitle}
                </h2>
                <div className="input-group">
                  <label htmlFor="pollTitle">{t.poll.titleLabel}</label>
                  <input
                    id="pollTitle"
                    type="text"
                    placeholder={t.poll.titlePlaceholder}
                    value={pollTitle}
                    onChange={(e) => setPollTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="pollContent">{t.poll.contentLabel}</label>
                  <textarea
                    id="pollContent"
                    rows="4"
                    placeholder={t.poll.contentPlaceholder}
                    value={pollContent}
                    onChange={(e) => setPollContent(e.target.value)}
                    required
                  ></textarea>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="btn-primary" disabled={actionLoading}>
                    {actionLoading 
                      ? (editingFormId ? t.poll.updating : t.poll.publishing) 
                      : (editingFormId ? t.poll.update : t.poll.publish)
                    }
                  </button>
                  {editingFormId && (
                    <button 
                      type="button" 
                      className="btn-outline" 
                      onClick={handleCancelEdit}
                      style={{ width: 'auto', padding: '0 1.5rem' }}
                    >
                      {t.common.cancel}
                    </button>
                  )}
                </div>
              </form>
            )}

            <div className="forms-list">
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', opacity: 0.6 }}>{t.poll.publishedListTitle} ({forms.length})</h2>
              {forms.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>{t.poll.noPollsYet}</p>
              ) : (
                forms.map(f => (
                  <div key={f.id} className="glass" style={{ padding: '1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{f.title}</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{f.content}</p>
                    </div>
                    <button 
                      onClick={() => handleEditForm(f)}
                      style={{ 
                        width: 'auto', 
                        background: 'rgba(255,255,255,0.05)', 
                        padding: '0.4rem 0.8rem', 
                        fontSize: '0.75rem', 
                        borderRadius: '0.5rem',
                        color: 'var(--accent)',
                        marginLeft: '1rem'
                      }}
                    >
                      {t.poll.edit}
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <button 
              onClick={async () => { 
                if(window.confirm(t.session.endConfirm)) { 
                  await api.endSession(session.id); 
                  init(); 
                } 
              }}
              className="btn-outline" 
              style={{ marginTop: '3rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'var(--danger)', opacity: 0.5 }}
            >
              {t.session.endSession}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
