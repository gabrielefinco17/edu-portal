import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api';
import t from '../i18n/IT.json';

function DonutChart({ data, size = 140 }) {
  const total = data.favorevole + data['non favorevole'] + data.astenuto;
  if (total === 0) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size} height={size} viewBox="0 0 140 140">
          <circle cx="70" cy="70" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
          <text x="70" y="75" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="13" fontFamily="Inter">0</text>
        </svg>
      </div>
    );
  }

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const pFav = data.favorevole / total;
  const pNon = data['non favorevole'] / total;
  const pAst = data.astenuto / total;

  const seg1 = pFav * circumference;
  const seg2 = pNon * circumference;
  const seg3 = pAst * circumference;

  const gap = 0;
  const offset1 = 0;
  const offset2 = -(seg1 + gap);
  const offset3 = -(seg1 + seg2 + gap * 2);

  return (
    <div style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="14" />
        {pFav > 0 && (
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#10b981" strokeWidth="14"
            strokeDasharray={`${seg1} ${circumference - seg1}`} strokeDashoffset={offset1}
            strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        )}
        {pNon > 0 && (
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#ef4444" strokeWidth="14"
            strokeDasharray={`${seg2} ${circumference - seg2}`} strokeDashoffset={offset2}
            strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        )}
        {pAst > 0 && (
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#f59e0b" strokeWidth="14"
            strokeDasharray={`${seg3} ${circumference - seg3}`} strokeDashoffset={offset3}
            strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        )}
      </svg>
      <div style={{ marginTop: -size + 'px', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <span style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: 'Outfit' }}>{total}</span>
      </div>
    </div>
  );
}

function BarStat({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.8rem', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>{value} <span style={{ color: 'var(--text-secondary)', fontWeight: '400' }}>({pct.toFixed(0)}%)</span></span>
      </div>
      <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: '3px', background: color,
          transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
        }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [forms, setForms] = useState([]);
  const [voteStats, setVoteStats] = useState({});
  const [attendanceStats, setAttendanceStats] = useState({ presenti: 0, usciti: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingForms, setLoadingForms] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('cp_user_data');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        setUser(null);
      }
    }

    const load = async () => {
      const allSessions = await api.getAllSessions();
      // Only show active or finished sessions to the public
      const visibleSessions = allSessions.filter(s => s.status === 'active' || s.status === 'finished');
      setSessions(visibleSessions);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      setForms([]);
      setVoteStats({});
      setAttendanceStats({ presenti: 0, usciti: 0 });
      return;
    }

    const loadForms = async () => {
      setLoadingForms(true);
      const sessionForms = await api.getFormsBySession(Number(selectedSessionId));
      setForms(sessionForms);
      
      const stats = await api.getPresenceStats(Number(selectedSessionId));
      setAttendanceStats(stats);

      if (sessionForms.length > 0) {
        const stats = await api.getBulkVoteStats(sessionForms.map(f => f.id));
        setVoteStats(stats);
      } else {
        setVoteStats({});
      }
      setLoadingForms(false);
    };
    loadForms();
  }, [selectedSessionId]);

  if (loading) {
    return <div className="container"><p>{t.loading.data}</p></div>;
  }

  return (
    <div className="container" style={{ justifyContent: 'flex-start', paddingTop: '6vh' }}>
      {/* Top bar with dynamic navigation */}
      <div className="top-bar">
        {user ? (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {user.email}
            </span>
            {user.role === 'super_user' && (
              <Link to="/admin" className="btn-primary" style={{
                textDecoration: 'none', display: 'inline-block', padding: '0.6rem 1.5rem',
                fontSize: '0.85rem', borderRadius: '0.75rem', width: 'auto', background: 'var(--accent)'
              }}>
                Area Amministrazione
              </Link>
            )}
            <Link to="/user" className="btn-primary" style={{
              textDecoration: 'none', display: 'inline-block', padding: '0.6rem 1.5rem',
              fontSize: '0.85rem', borderRadius: '0.75rem', width: 'auto'
            }}>
              Area Voto
            </Link>
            <button 
              onClick={() => {
                api.logout();
              }}
              className="btn-outline"
              style={{
                padding: '0.6rem 1.5rem', fontSize: '0.85rem', borderRadius: '0.75rem', width: 'auto', color: 'var(--danger)', borderColor: 'var(--danger)'
              }}
            >
              Esci
            </button>
          </div>
        ) : (
          <Link to="/login" className="btn-primary" style={{
            textDecoration: 'none', display: 'inline-block', padding: '0.6rem 1.5rem',
            fontSize: '0.85rem', borderRadius: '0.75rem', width: 'auto'
          }}>
            {t.login.loginButton}
          </Link>
        )}
      </div>

      <div style={{ width: '100%', maxWidth: '700px' }}>
        {/* Title */}
        <h1 className="fade-in" style={{ textAlign: 'center', marginBottom: '2.5rem', fontSize: '2rem' }}>
          {t.dashboard.title}
        </h1>

        {/* Session dropdown */}
        <div className="fade-in btn-group-mobile" style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <select
              id="session-select"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              style={{
                width: '100%', padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--glass-border)', borderRadius: '0.75rem', color: 'white',
                fontSize: '1rem', fontFamily: 'inherit', cursor: 'pointer',
                appearance: 'none', WebkitAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23ffffff' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.25rem center',
                minHeight: '3.5rem'
              }}
            >
              <option value="" style={{ background: '#111' }}>{t.dashboard.selectSession}</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id} style={{ background: '#111' }}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          {selectedSessionId && !loadingForms && (
            <div className="glass" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '1rem 1.5rem', minWidth: '150px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t.dashboard.presenti}</span>
              <span style={{ fontSize: '1.5rem', fontWeight: '800' }}>{attendanceStats.presenti}</span>
            </div>
          )}
        </div>

        {/* Content */}
        {!selectedSessionId && sessions.length === 0 && (
          <div className="glass fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>{t.dashboard.noSessions}</p>
          </div>
        )}

        {selectedSessionId && loadingForms && (
          <div className="glass fade-in" style={{ textAlign: 'center', padding: '3rem' }}>
            <p>{t.loading.data}</p>
          </div>
        )}

        {selectedSessionId && !loadingForms && forms.length === 0 && (
          <div className="glass fade-in" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>{t.dashboard.noPolls}</p>
          </div>
        )}

        {selectedSessionId && !loadingForms && forms.length > 0 && (
          <div className="fade-in">
            {forms.map(form => {
              const stats = voteStats[form.id] || { favorevole: 0, 'non favorevole': 0, astenuto: 0 };
              const total = stats.favorevole + stats['non favorevole'] + stats.astenuto;
              return (
                <div key={form.id} className="glass" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>{form.title}</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    {form.content}
                  </p>

                  <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Donut chart */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <DonutChart data={stats} />
                      <span style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {t.dashboard.totalVotes}
                      </span>
                    </div>

                    {/* Bar stats */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <BarStat label={t.vote.favorevole} value={stats.favorevole} total={total} color="#10b981" />
                      <BarStat label={t.vote.nonFavorevole} value={stats['non favorevole']} total={total} color="#ef4444" />
                      <BarStat label={t.vote.astenuto} value={stats.astenuto} total={total} color="#f59e0b" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
