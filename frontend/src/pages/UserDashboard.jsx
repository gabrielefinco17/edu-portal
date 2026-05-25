import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import t from '../i18n/IT.json';

const VOTE_OPTIONS = [t.vote.favorevole, t.vote.nonFavorevole, t.vote.astenuto];

export default function UserDashboard() {
  const [session, setSession] = useState(null);
  const [forms, setForms] = useState([]);
  const [userEmail, setUserEmail] = useState('');
  const [votes, setVotes] = useState({});
  const [selectedOptions, setSelectedOptions] = useState({});
  const [attendanceState, setAttendanceState] = useState({ isPresent: false, hasExited: false });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('cp_user_data'));
    if (!userData || (userData.role !== 'user' && userData.role !== 'super_user')) {
      navigate('/login');
      return;
    }
    setUserEmail(userData.email);

    const savedVotes = JSON.parse(localStorage.getItem('cp_user_votes') || '{}');
    setVotes(savedVotes);

    const fetchData = async () => {
      try {
        const activeSession = await api.getActiveSession();
        setSession(activeSession);
        if (activeSession) {
          const publishedForms = await api.getForms();
          setForms(publishedForms);
          const att = await api.getUserAttendance(activeSession.id);
          setAttendanceState(att);
        }
      } catch (err) {
        console.error(t.api.fetchError);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleAttendance = async (status) => {
    if (!session || attendanceLoading) return;
    
    if (status === 'exited') {
      if (!window.confirm(t.session.confirmExit)) return;
    }

    setAttendanceLoading(true);
    try {
      await api.setAttendanceStatus(session.id, status);
      if (status === 'present') {
        setAttendanceState({ isPresent: true, hasExited: false });
      } else if (status === 'exited') {
        setAttendanceState({ isPresent: false, hasExited: true });
      }
    } catch (err) {
      alert("Errore nell'aggiornamento della presenza");
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleSelect = (formId, option) => {
    if (votes[formId] || !attendanceState.isPresent) return;
    setSelectedOptions({ ...selectedOptions, [formId]: option });
  };

  const handleConfirm = async (formId) => {
    const option = selectedOptions[formId];
    if (!option || votes[formId] || !attendanceState.isPresent) return;
    
    setSubmitting(formId);
    try {
      await api.submitVote(formId, option);
      const updatedVotes = { ...votes, [formId]: option };
      setVotes(updatedVotes);
      localStorage.setItem('cp_user_votes', JSON.stringify(updatedVotes));
      
      const updatedSelections = { ...selectedOptions };
      delete updatedSelections[formId];
      setSelectedOptions(updatedSelections);
    } catch (err) {
      alert(t.vote.error);
    } finally {
      setSubmitting(null);
    }
  };

  const handleCancel = (formId) => {
    const updatedSelections = { ...selectedOptions };
    delete updatedSelections[formId];
    setSelectedOptions(updatedSelections);
  };

  if (loading) {
    return <div className="container"><p>{t.loading.session}</p></div>;
  }

  return (
    <div className="container" style={{ justifyContent: 'flex-start', paddingTop: '10vh' }}>
      <div className="top-bar">
        <span>{userEmail}</span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button 
            onClick={() => navigate('/')} 
            style={{ width: 'auto', background: 'transparent', padding: '0 1rem', fontSize: '0.8rem', color: 'var(--accent)' }}
          >
            Risultati
          </button>
          {JSON.parse(localStorage.getItem('cp_user_data'))?.role === 'super_user' && (
            <button 
              onClick={() => navigate('/admin')} 
              style={{ width: 'auto', background: 'transparent', padding: '0 1rem', fontSize: '0.8rem', color: 'var(--accent)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}
            >
              {t.login.goToAdmin}
            </button>
          )}
          <button 
            onClick={() => api.logout()} 
            style={{ width: 'auto', background: 'transparent', padding: '0 0 0 1rem', fontSize: '0.8rem', color: 'var(--danger)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}
          >
            {t.common.logout}
          </button>
        </div>
      </div>

      <div className="dashboard-card glass fade-in" style={{ background: 'transparent', border: 'none', padding: '0' }}>
        {!session ? (
          <div className="glass" style={{ textAlign: 'center', padding: '4rem' }}>
            <h1 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>{t.session.noActiveTitle}</h1>
            <p>{t.session.noActiveDescription}</p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase' }}>
                {t.session.participationLabel}
              </span>
              <h1 style={{ marginTop: '0.5rem' }}>{session.title}</h1>
            </div>

            {/* Attendance Section */}
            <div className="glass" style={{ padding: '2rem', marginBottom: '3rem', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Stato Presenza in Aula</h3>
              
              {attendanceState.hasExited ? (
                <div className="fade-in" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem', border: '1px solid var(--danger)' }}>
                  <p style={{ color: 'var(--danger)', fontWeight: '500' }}>{t.session.alreadyExited}</p>
                </div>
              ) : (
                <>
                  <div className="btn-group-mobile" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button 
                      className={`btn-primary ${attendanceState.isPresent ? '' : 'btn-outline'}`} 
                      style={{ width: 'auto', padding: '0.75rem 2rem', background: attendanceState.isPresent ? 'var(--success)' : 'transparent', borderColor: attendanceState.isPresent ? 'var(--success)' : 'var(--glass-border)' }}
                      onClick={() => handleAttendance('present')}
                      disabled={attendanceLoading || attendanceState.isPresent}
                    >
                      {t.session.markPresent}
                    </button>
                    <button 
                      className={`btn-primary ${!attendanceState.isPresent ? '' : 'btn-outline'}`} 
                      style={{ width: 'auto', padding: '0.75rem 2rem', background: !attendanceState.isPresent ? 'var(--danger)' : 'transparent', borderColor: !attendanceState.isPresent ? 'var(--danger)' : 'var(--glass-border)' }}
                      onClick={() => handleAttendance('exited')}
                      disabled={attendanceLoading || !attendanceState.isPresent || (forms.length > 0 && !forms.every(f => votes[f.id]))}
                    >
                      {t.session.markExit}
                    </button>
                  </div>
                  <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: attendanceState.isPresent ? 'var(--success)' : 'var(--text-secondary)' }}>
                    {attendanceState.isPresent ? t.session.presenceRecorded : t.session.presencePrompt}
                  </p>
                  {attendanceState.isPresent && forms.length > 0 && !forms.every(f => votes[f.id]) && (
                    <p className="fade-in" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--danger)' }}>
                      {t.session.mustVoteAll}
                    </p>
                  )}
                </>
              )}
            </div>

            {forms.length === 0 ? (
              <div className="glass" style={{ textAlign: 'center', padding: '3rem' }}>
                <h2 style={{ color: 'var(--text-secondary)' }}>{t.session.sessionOpen}</h2>
                <p style={{ marginTop: '1rem' }}>{t.session.waitingForPolls}</p>
              </div>
            ) : (
              forms.map(form => (
                <div key={form.id} className="glass fade-in" style={{ padding: '2.5rem', marginBottom: '2rem', opacity: attendanceState.isPresent ? 1 : 0.5, pointerEvents: attendanceState.isPresent ? 'auto' : 'none', transition: 'opacity 0.3s ease' }}>
                  <h2 style={{ marginBottom: '1rem' }}>{form.title}</h2>
                  <p style={{ whiteSpace: 'pre-wrap', marginBottom: '2.5rem', color: 'var(--text-secondary)' }}>
                    {form.content}
                  </p>

                  <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '2rem' }}>
                    <div className="vote-grid" style={{ opacity: selectedOptions[form.id] ? 0.4 : 1, transition: 'opacity 0.3s ease' }}>
                      {VOTE_OPTIONS.map(opt => (
                        <button 
                          key={opt}
                          className={`vote-btn ${votes[form.id] === opt || selectedOptions[form.id] === opt ? 'active' : ''}`}
                          onClick={() => handleSelect(form.id, opt)}
                          disabled={!!votes[form.id] || (!!selectedOptions[form.id] && selectedOptions[form.id] !== opt) || !attendanceState.isPresent}
                          style={{ textTransform: 'capitalize' }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    {selectedOptions[form.id] && !votes[form.id] && attendanceState.isPresent && (
                      <div className="fade-in" style={{ marginTop: '2rem', textAlign: 'center' }}>
                        <p style={{ marginBottom: '1.5rem', fontWeight: '500' }}>
                          {t.vote.confirmPrompt}
                        </p>
                        <div className="btn-group-mobile" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                          <button 
                            className="btn-primary" 
                            onClick={() => handleConfirm(form.id)} 
                            style={{ width: 'auto', padding: '0.75rem 2rem' }}
                            disabled={submitting === form.id}
                          >
                            {submitting === form.id ? t.common.sending : t.common.confirm}
                          </button>
                          <button 
                            className="btn-outline" 
                            onClick={() => handleCancel(form.id)} 
                            style={{ width: 'auto', padding: '0.75rem 2rem' }}
                            disabled={submitting === form.id}
                          >
                            {t.common.cancel}
                          </button>
                        </div>
                      </div>
                    )}

                    {votes[form.id] && (
                      <p style={{ marginTop: '1.5rem', color: 'var(--success)', textAlign: 'center', fontWeight: '600' }}>
                        {t.vote.registered} <span style={{ textTransform: 'capitalize' }}>{votes[form.id]}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
