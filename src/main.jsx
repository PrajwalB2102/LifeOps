import React, { Component, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './lib/supabase';
import './styles.css';

const KEYS = {
  onboarding: 'lifeops.onboarding.v1',
  data: (id) => `lifeops.data.${id}.v1`,
};

const localDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('LifeOps could not save local data.', error);
    return false;
  }
};

function authErrorMessage(error) {
  const message = (error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'That email or password is incorrect.';
  if (message.includes('user already registered')) return 'An account with that email already exists.';
  if (message.includes('password')) return 'Use a stronger password and try again.';
  if (message.includes('email')) return 'Enter a valid email address.';
  if (message.includes('rate limit')) return 'Too many attempts. Please wait and try again.';
  return 'We could not complete that request. Please try again.';
}

const blankData = (name = 'there') => ({
  profile: { name, email: '', pronouns: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time' },
  tasks: [],
  habits: [],
  goals: [],
});

const mapTaskRow = (row) => ({
  id: row.id,
  title: row.title,
  notes: row.notes || '',
  due: row.due_date || '',
  done: row.completed,
});

class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('LifeOps failed to render.', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <main className="error-screen"><span className="brand-mark">L</span><h1>LifeOps needs a refresh.</h1><p>Your local data is still on this device. Reload the app to try again.</p><button className="primary-button" onClick={() => window.location.reload()}>Reload LifeOps <span>→</span></button></main>;
  }
}

function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(() => read(KEYS.onboarding, false));
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 220);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) console.error('LifeOps could not restore the Supabase session.');
      setSession(error ? null : data.session);
      setAuthLoading(false);
    };
    restoreSession();
    const { data: authState } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setAuthLoading(false);
      }
    });
    return () => {
      mounted = false;
      authState.subscription.unsubscribe();
    };
  }, []);

  const finishOnboarding = () => {
    write(KEYS.onboarding, true);
    setOnboarded(true);
  };
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('LifeOps could not sign out of Supabase.');
  };
  const deleteAccount = async (id) => {
    localStorage.removeItem(KEYS.data(id));
    await signOut();
  };

  if (!ready) return <div className="boot-screen"><span className="brand-mark">L</span><span>Loading your workspace…</span></div>;
  if (authLoading) return <div className="boot-screen"><span className="brand-mark">L</span><span>Restoring your session…</span></div>;
  if (!onboarded) return <Onboarding onComplete={finishOnboarding} />;
  if (!session) return <Auth />;

  const account = {
    id: session.user.id,
    name: session.user.user_metadata?.display_name || '',
    email: session.user.email || '',
  };
  return <LifeOps account={account} onSignOut={signOut} onDeleteAccount={deleteAccount} />;
}

function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const slides = [
    { eyebrow: 'A calmer operating system', title: <>Make space for what<br /><em>matters today.</em></>, body: 'LifeOps keeps your tasks, habits, and goals in one quiet place — built to work offline on this device.', icon: '◌' },
    { eyebrow: 'See the whole picture', title: <>Small actions.<br /><em>Clear direction.</em></>, body: 'Connect everyday actions to bigger goals, then use momentum instead of guilt to keep going.', icon: '↗' },
    { eyebrow: 'Private by default', title: <>Your life stays<br /><em>with you.</em></>, body: 'LifeOps uses a Supabase-backed account and synced workspace data, with local preferences kept on this device.', icon: '⌁' },
  ];
  const slide = slides[step];
  return <main className="onboarding">
    <div className="onboarding-top"><a className="brand" href="#welcome"><span className="brand-mark">L</span><span>lifeops</span></a><button className="quiet-button" onClick={onComplete}>Skip intro</button></div>
    <div className="onboarding-content">
      <div className="onboarding-visual" aria-hidden="true"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><span>{slide.icon}</span><small>LOCAL / INTENTIONAL / HUMAN</small></div>
      <div className="onboarding-copy"><span className="eyebrow"><span className="pulse"></span>{slide.eyebrow}</span><h1>{slide.title}</h1><p>{slide.body}</p><div className="onboarding-actions"><button className="primary-button" onClick={() => step === slides.length - 1 ? onComplete() : setStep(step + 1)}>{step === slides.length - 1 ? 'Get started' : 'Next'} <span>→</span></button><div className="step-dots" aria-label={`Step ${step + 1} of ${slides.length}`}>{slides.map((item, index) => <button key={item.eyebrow} aria-label={`Go to step ${index + 1}`} className={index === step ? 'active' : ''} onClick={() => setStep(index)} />)}</div></div></div>
    </div>
    <p className="onboarding-footnote">Supabase account required · Core workspace data syncs securely</p>
  </main>;
}

function Auth() {
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ name: '', email: '', password: '', nextPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const switchMode = (next) => { setMode(next); setError(''); setMessage(''); };
  const submit = async (event) => {
    event.preventDefault();
    setError(''); setMessage('');
    const email = form.email.trim().toLowerCase();
    if (!email || (mode !== 'forgot' && !form.password)) return setError('Enter your email and password.');
    if (mode === 'signup' && !form.name.trim()) return setError('Tell us your name first.');
    setSubmitting(true);
    try {
      let result;
      if (mode === 'signup') {
        result = await supabase.auth.signUp({ email, password: form.password, options: { data: { display_name: form.name.trim() } } });
        if (!result.error && !result.data.session) {
          setMessage('Check your email to confirm your account, then sign in.');
          setMode('signin');
        }
      } else if (mode === 'signin') {
        result = await supabase.auth.signInWithPassword({ email, password: form.password });
      } else {
        result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${window.location.pathname}` });
        if (!result.error) setMessage('If an account exists for that email, a password reset link is on its way.');
      }
      if (result?.error) setError(authErrorMessage(result.error));
    } catch (authError) {
      console.error('LifeOps authentication request failed.', authError);
      setError('Authentication is temporarily unavailable. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  return <main className="auth-page"><div className="auth-card">
    <a className="brand auth-brand" href="#auth"><span className="brand-mark">L</span><span>lifeops</span></a>
    <span className="eyebrow compact">SYNCED WORKSPACE</span>
    <h1>{mode === 'signup' ? 'Create your space.' : mode === 'forgot' ? 'Reset your password.' : 'Welcome back.'}</h1>
    <p className="auth-intro">A private, account-backed place to make tomorrow make sense.</p>
    <div className="local-note"><span>⌁</span><span><strong>Synced workspace</strong><small>Your account and core workspace data sync securely.</small></span></div>
    <form onSubmit={submit} noValidate>
      {mode === 'signup' && <label>Name<input name="name" value={form.name} onChange={update} autoComplete="name" placeholder="What should we call you?" /></label>}
      <label>Email<input name="email" type="email" value={form.email} onChange={update} autoComplete="email" placeholder="you@example.com" /></label>
      {mode !== 'forgot' && <label>Password<input name="password" type="password" value={form.password} onChange={update} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="At least 6 characters" /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
      <button className="primary-button full-width" type="submit" disabled={submitting}>{submitting ? 'Working…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset email' : 'Sign in'} <span>→</span></button>
    </form>
    <div className="auth-links">{mode === 'signin' && <button onClick={() => switchMode('forgot')}>Forgot password?</button>}<button onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}>{mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button></div>
  </div></main>;
}

function LifeOps({ account, onSignOut, onDeleteAccount }) {
  const [page, setPage] = useState('home');
  const [brightMode, setBrightMode] = useState(() => read('lifeops.theme.v1', false));
  const [data, setData] = useState({});
  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState([]);
  const [goals, setGoals] = useState([]);
  const [profile, setProfile] = useState({
    name: account.name || '',
    email: account.email || '',
    pronouns: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });
  const [tasksLoading, setTasksLoading] = useState(true);
  const [habitsLoading, setHabitsLoading] = useState(true);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState('');
  const taskMetadata = React.useRef(new Map());
  const goalMetadata = React.useRef(new Map());
  const legacyWorkspace = React.useRef(read(KEYS.data(account.id), null));
  useEffect(() => {
    const current = read(KEYS.data(account.id), null);
    write(KEYS.data(account.id), {
      ...data,
      ...(legacyWorkspace.current?.tasks ? { tasks: current?.tasks || legacyWorkspace.current.tasks } : {}),
      ...(legacyWorkspace.current?.habits ? { habits: current?.habits || legacyWorkspace.current.habits } : {}),
      ...(legacyWorkspace.current?.goals ? { goals: current?.goals || legacyWorkspace.current.goals } : {}),
      ...(legacyWorkspace.current?.profile ? { profile: current?.profile || legacyWorkspace.current.profile } : {}),
    });
  }, [account.id, data]);
  useEffect(() => {
    let active = true;
    setTasksLoading(true);
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', account.id)
      .order('created_at', { ascending: false })
      .then(({ data: rows, error }) => {
        if (!active) return;
        if (error) {
          setNotice('Couldn’t load your tasks. Please refresh and try again.');
        } else {
          taskMetadata.current = new Map((rows || []).map((row) => [row.id, { completed_at: row.completed_at }]));
          setTasks((rows || []).map(mapTaskRow));
        }
        setTasksLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setNotice('Couldn’t load your tasks. Please refresh and try again.');
        setTasksLoading(false);
      });
    return () => {
      active = false;
      taskMetadata.current = new Map();
      setTasks([]);
    };
  }, [account.id]);
  useEffect(() => {
    let active = true;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setProfileLoading(true);
    setProfile({
      name: account.name || '',
      email: account.email || '',
      pronouns: '',
      timezone,
    });
    const loadProfile = async () => {
      const { data: row, error } = await supabase
        .from('profiles')
        .select('id, display_name, pronouns, timezone')
        .eq('id', account.id)
        .maybeSingle();
      if (error) throw error;
      if (!row) {
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: account.id,
            display_name: account.name || '',
            pronouns: '',
            timezone,
          })
          .select()
          .single();
        if (createError) throw createError;
        if (!active) return;
        setProfile({
          name: created.display_name || account.name || '',
          email: account.email || '',
          pronouns: created.pronouns || '',
          timezone: created.timezone || timezone,
        });
      } else if (active) {
        setProfile({
          name: row.display_name || account.name || '',
          email: account.email || '',
          pronouns: row.pronouns || '',
          timezone: row.timezone || timezone,
        });
      }
      if (active) setProfileLoading(false);
    };
    loadProfile().catch(() => {
      if (!active) return;
      setNotice('Couldn’t load your profile. Please refresh and try again.');
      setProfileLoading(false);
    });
    return () => {
      active = false;
    };
  }, [account.id, account.name, account.email]);
  useEffect(() => {
    let active = true;
    setGoalsLoading(true);
    setGoals([]);
    supabase
      .from('goals')
      .select('*')
      .eq('user_id', account.id)
      .order('created_at', { ascending: false })
      .then(({ data: rows, error }) => {
        if (!active) return;
        if (error) {
          setNotice('Couldn’t load your goals. Please refresh and try again.');
        } else {
          goalMetadata.current = new Map((rows || []).map((row) => [row.id, { completed_at: row.completed_at }]));
          setGoals((rows || []).map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description || '',
            area: row.area || 'Personal',
            target: Number(row.target),
            progress: Number(row.progress) || 0,
            deadline: row.deadline || '',
          })));
        }
        setGoalsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setNotice('Couldn’t load your goals. Please refresh and try again.');
        setGoalsLoading(false);
      });
    return () => {
      active = false;
      goalMetadata.current = new Map();
      setGoals([]);
    };
  }, [account.id]);
  useEffect(() => {
    let active = true;
    setHabitsLoading(true);
    setHabits([]);
    const loadHabits = async () => {
      const { data: rows, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', account.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error) throw error;
      const habitIds = (rows || []).map((row) => row.id);
      let completionRows = [];
      if (habitIds.length) {
        const { data: completions, error: completionError } = await supabase
          .from('habit_completions')
          .select('habit_id, completed_on')
          .in('habit_id', habitIds);
        if (completionError) throw completionError;
        completionRows = completions || [];
      }
        if (!active) return;
        const completionsByHabit = new Map();
      completionRows.forEach((row) => {
        const completions = completionsByHabit.get(row.habit_id) || {};
        completions[row.completed_on] = true;
        completionsByHabit.set(row.habit_id, completions);
      });
      setHabits((rows || []).map((row) => ({
        id: row.id,
        title: row.title,
        frequency: row.frequency,
        completions: completionsByHabit.get(row.id) || {},
      })));
      setHabitsLoading(false);
    };
    loadHabits().catch(() => {
      if (!active) return;
      setNotice('Couldn’t load your habits. Please refresh and try again.');
      setHabitsLoading(false);
    });
    return () => {
      active = false;
      setHabits([]);
    };
  }, [account.id]);
  const updateData = (updates) => setData((current) => ({ ...current, ...updates }));
  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  };
  const saveTask = async (item) => {
    const existing = item.id ? tasks.find((task) => task.id === item.id) : null;
    const completed = Boolean(item.done);
    const completedAt = completed
      ? existing?.done
        ? taskMetadata.current.get(item.id)?.completed_at || null
        : new Date().toISOString()
      : null;
    const payload = {
      title: item.title.trim(),
      notes: item.notes?.trim() || null,
      due_date: item.due || null,
      completed,
      completed_at: completedAt,
    };
    const request = item.id
      ? supabase.from('tasks').update(payload).eq('id', item.id).eq('user_id', account.id).select().single()
      : supabase.from('tasks').insert({ ...payload, user_id: account.id }).select().single();
    const { data: row, error } = await request;
    if (error) {
      showNotice(item.id ? 'Couldn’t update that task. Please try again.' : 'Couldn’t save that task. Please try again.');
      return false;
    }
    taskMetadata.current.set(row.id, { completed_at: row.completed_at });
    setTasks((current) => item.id
      ? current.map((task) => task.id === row.id ? mapTaskRow(row) : task)
      : [mapTaskRow(row), ...current]);
    showNotice(item.id ? 'Task updated' : 'Task saved');
    return true;
  };
  const saveHabit = async (item) => {
    const existing = item.id ? habits.find((habit) => habit.id === item.id) : null;
    const request = item.id
      ? supabase
        .from('habits')
        .update({ title: item.title.trim(), frequency: item.frequency || 'Daily' })
        .eq('id', item.id)
        .eq('user_id', account.id)
        .select()
        .single()
      : supabase
        .from('habits')
        .insert({ user_id: account.id, title: item.title.trim(), frequency: item.frequency || 'Daily' })
        .select()
        .single();
    const { data: row, error } = await request;
    if (error) {
      showNotice(item.id ? 'Couldn’t update that habit. Please try again.' : 'Couldn’t save that habit. Please try again.');
      return false;
    }
    const nextHabit = {
      id: row.id,
      title: row.title,
      frequency: row.frequency,
      completions: existing?.completions || {},
    };
    setHabits((current) => item.id
      ? current.map((habit) => habit.id === row.id ? nextHabit : habit)
      : [nextHabit, ...current]);
    showNotice(item.id ? 'Habit updated' : 'Habit saved');
    return true;
  };
  const saveGoal = async (item) => {
    const target = Math.max(1, Number(item.target) || 1);
    const progress = Math.max(0, Math.min(target, Number(item.progress) || 0));
    const existing = item.id ? goals.find((goal) => goal.id === item.id) : null;
    const previousCompletedAt = item.id ? goalMetadata.current.get(item.id)?.completed_at : null;
    const completedAt = progress >= target
      ? existing && existing.progress >= existing.target
        ? previousCompletedAt || new Date().toISOString()
        : new Date().toISOString()
      : null;
    const payload = {
      title: item.title.trim(),
      description: item.description?.trim() || null,
      area: item.area || 'Personal',
      target,
      progress,
      deadline: item.deadline || null,
      completed_at: completedAt,
    };
    const request = item.id
      ? supabase.from('goals').update(payload).eq('id', item.id).eq('user_id', account.id).select().single()
      : supabase.from('goals').insert({ user_id: account.id, ...payload }).select().single();
    const { data: row, error } = await request;
    if (error) {
      showNotice(item.id ? 'Couldn’t update that goal. Please try again.' : 'Couldn’t save that goal. Please try again.');
      return false;
    }
    goalMetadata.current.set(row.id, { completed_at: row.completed_at });
    const nextGoal = {
      id: row.id,
      title: row.title,
      description: row.description || '',
      area: row.area || 'Personal',
      target: Number(row.target),
      progress: Number(row.progress) || 0,
      deadline: row.deadline || '',
    };
    setGoals((current) => item.id
      ? current.map((goal) => goal.id === row.id ? nextGoal : goal)
      : [nextGoal, ...current]);
    showNotice(item.id ? 'Goal updated' : 'Goal saved');
    return true;
  };
  const saveItem = async (type, item) => {
    if (type === 'tasks') return saveTask(item);
    if (type === 'habits') return saveHabit(item);
    if (type === 'goals') return saveGoal(item);
    const collection = data[type];
    const next = item.id ? collection.map((value) => value.id === item.id ? item : value) : [{ ...item, id: makeId(type.slice(0, -1)) }, ...collection];
    updateData({ [type]: next }); setEditor(null); showNotice(`${type.slice(0, -1)} saved`);
    return true;
  };
  const removeItem = async (type, id) => {
    if (type === 'tasks') {
      const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', account.id);
      if (error) {
        showNotice('Couldn’t delete that task. Please try again.');
        return false;
      }
      taskMetadata.current.delete(id);
      setTasks((current) => current.filter((task) => task.id !== id));
      setEditor(null);
      showNotice('Task deleted');
      return true;
    }
    if (type === 'habits') {
      const { error } = await supabase
        .from('habits')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', account.id);
      if (error) {
        showNotice('Couldn’t archive that habit. Please try again.');
        return false;
      }
      setHabits((current) => current.filter((habit) => habit.id !== id));
      setEditor(null);
      showNotice('Habit archived');
      return true;
    }
    if (type === 'goals') {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('user_id', account.id);
      if (error) {
        showNotice('Couldn’t delete that goal. Please try again.');
        return false;
      }
      goalMetadata.current.delete(id);
      setGoals((current) => current.filter((goal) => goal.id !== id));
      setEditor(null);
      showNotice('Goal deleted');
      return true;
    }
    updateData({ [type]: data[type].filter((item) => item.id !== id) }); setEditor(null);
    return true;
  };
  const toggleTask = async (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return false;
    const completed = !task.done;
    const { data: row, error } = await supabase
      .from('tasks')
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq('id', id)
      .eq('user_id', account.id)
      .select()
      .single();
    if (error) {
      showNotice('Couldn’t update that task. Please try again.');
      return false;
    }
    taskMetadata.current.set(id, { completed_at: row.completed_at });
    setTasks((current) => current.map((item) => item.id === id ? mapTaskRow(row) : item));
    return true;
  };
  const toggleHabit = async (id) => {
    const date = localDate();
    const habit = habits.find((item) => item.id === id);
    if (!habit) return false;
    const completed = Boolean((habit.completions || {})[date]);
    const request = completed
      ? supabase
        .from('habit_completions')
        .delete()
        .eq('habit_id', id)
        .eq('completed_on', date)
      : supabase
        .from('habit_completions')
        .insert({ habit_id: id, completed_on: date });
    const { error } = await request;
    if (error) {
      showNotice('Couldn’t update that habit. Please try again.');
      return false;
    }
    setHabits((current) => current.map((item) => item.id === id
      ? { ...item, completions: { ...(item.completions || {}), [date]: !completed } }
      : item));
    return true;
  };
  const updateGoalProgress = async (id, progress) => {
    const goal = goals.find((item) => item.id === id);
    if (!goal) return false;
    const nextProgress = Math.max(0, Math.min(Number(goal.target), Number(progress) || 0));
    const existingCompletedAt = goalMetadata.current.get(id)?.completed_at;
    const completedAt = nextProgress >= Number(goal.target)
      ? existingCompletedAt || new Date().toISOString()
      : null;
    const { data: row, error } = await supabase
      .from('goals')
      .update({ progress: nextProgress, completed_at: completedAt })
      .eq('id', id)
      .eq('user_id', account.id)
      .select()
      .single();
    if (error) {
      showNotice('Couldn’t update that goal. Please try again.');
      return false;
    }
    goalMetadata.current.set(id, { completed_at: row.completed_at });
    setGoals((current) => current.map((item) => item.id === id
      ? { ...item, progress: Number(row.progress) || 0 }
      : item));
    return true;
  };
  const saveProfile = async (next) => {
    const name = next.name.trim();
    const pronouns = next.pronouns.trim();
    const timezone = next.timezone || 'UTC';
    const { data: row, error } = await supabase
      .from('profiles')
      .update({
        display_name: name,
        pronouns: pronouns || null,
        timezone,
      })
      .eq('id', account.id)
      .select()
      .single();
    if (error) {
      showNotice('Couldn’t save your profile. Please try again.');
      return false;
    }
    setProfile({
      name: row.display_name || '',
      email: account.email || '',
      pronouns: row.pronouns || '',
      timezone: row.timezone || 'UTC',
    });
    showNotice('Profile saved');
    return true;
  };
  const nav = [{ id: 'home', label: 'Home', icon: '⌂' }, { id: 'tasks', label: 'Tasks', icon: '✓', count: tasks.filter((task) => !task.done).length }, { id: 'habits', label: 'Habits', icon: '◌' }, { id: 'goals', label: 'Goals', icon: '↗' }, { id: 'profile', label: 'Profile', icon: '◎' }];
  const pageTitle = nav.find((item) => item.id === page)?.label || 'Home';
  const toggleTheme = () => {
    const next = !brightMode;
    setBrightMode(next);
    write('lifeops.theme.v1', next);
  };
  if (tasksLoading || habitsLoading || goalsLoading || profileLoading) return <div className="boot-screen"><span className="brand-mark">L</span><span>Loading your workspace…</span></div>;
  return <main className={`app-shell ${brightMode ? 'bright-mode' : ''}`}>
    <aside className="sidebar"><a className="brand" href="#top"><span className="brand-mark">L</span><span>lifeops</span></a><nav aria-label="Main navigation">{nav.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? 'selected' : ''}`} onClick={() => setPage(item.id)}><span>{item.icon}</span>{item.label}{item.count > 0 && <b>{item.count}</b>}</button>)}</nav><div className="sidebar-bottom"><button className="upgrade" onClick={() => { setPage('profile'); setNotice('Premium is not connected yet — nothing has been unlocked.'); }}>✦ Explore Plus</button><button className="profile-switcher" onClick={() => setPage('profile')}><span className="avatar">{initials(profile.name || account.name)}</span><span>{profile.name || account.name}<small>Free plan</small></span><i>⌄</i></button></div></aside>
    <section className="content" id="top"><header className="topbar"><div className="crumb">{formatDate()} <span>•</span> <b>{pageTitle}</b></div><div className="top-actions"><button className="theme-toggle" onClick={toggleTheme} aria-label={brightMode ? 'Switch to dark mode' : 'Switch to cream bright mode'} title={brightMode ? 'Switch to dark mode' : 'Switch to cream bright mode'}><span>{brightMode ? '☾' : '☼'}</span>{brightMode ? 'Dim' : 'Bright'}</button><span className="offline-chip"><i></i> Synced</span><button className="help-btn" aria-label="About synced workspace data" title="Your account data syncs through Supabase; local preferences may remain on this device">?</button></div></header>
      <div className="mobile-brand"><span className="brand-mark">L</span> lifeops</div><nav className="mobile-tabs" aria-label="Mobile navigation">{nav.map((item) => <button key={item.id} className={page === item.id ? 'selected' : ''} onClick={() => setPage(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      {notice && <div className="toast" role="status">{notice}</div>}
      {page === 'home' && <Home data={{ ...data, tasks }} habits={habits} goals={goals} profile={profile} onNavigate={setPage} onToggleHabit={toggleHabit} onToggleTask={toggleTask} onAdd={() => setEditor({ type: 'tasks', item: null })} />}
      {page === 'tasks' && <Tasks tasks={tasks} onAdd={() => setEditor({ type: 'tasks', item: null })} onEdit={(item) => setEditor({ type: 'tasks', item })} onDelete={(id) => removeItem('tasks', id)} onToggle={toggleTask} />}
      {page === 'habits' && <Habits habits={habits} onAdd={() => setEditor({ type: 'habits', item: null })} onEdit={(item) => setEditor({ type: 'habits', item })} onDelete={(id) => removeItem('habits', id)} onToggle={toggleHabit} />}
      {page === 'goals' && <Goals goals={goals} onAdd={() => setEditor({ type: 'goals', item: null })} onEdit={(item) => setEditor({ type: 'goals', item })} onDelete={(id) => removeItem('goals', id)} onProgress={updateGoalProgress} />}
      {page === 'profile' && <Profile account={account} profile={profile} onSave={saveProfile} onSignOut={onSignOut} onDelete={() => onDeleteAccount(account.id)} />}
    </section>
    {editor && <Editor type={editor.type} item={editor.item} onClose={() => setEditor(null)} onSave={(item) => saveItem(editor.type, item)} onDelete={editor.item ? () => removeItem(editor.type, editor.item.id) : null} />}
  </main>;
}

function Home({ data, habits, goals, profile, onNavigate, onToggleHabit, onToggleTask, onAdd }) {
  const openTasks = data.tasks.filter((task) => !task.done);
  const completedHabits = habits.filter((habit) => (habit.completions || {})[localDate()]).length;
  return <div className="page"><section className="hero compact-hero"><div className="eyebrow"><span className="pulse"></span> YOUR DAY, CALCULATED</div><h1>Good morning, {firstName(profile.name)}.<br /><em>Keep it intentional.</em></h1><p>One clear next step is better than a perfect plan.</p><div className="quick-actions"><button className="primary-button" onClick={onAdd}>+ Add a task</button><button className="secondary-button" onClick={() => onNavigate('habits')}>Check habits <span>→</span></button></div></section>
    <section className="summary-grid"><Summary value={openTasks.length} label="open tasks" icon="✓" onClick={() => onNavigate('tasks')} /><Summary value={`${completedHabits}/${habits.length}`} label="habits today" icon="◌" onClick={() => onNavigate('habits')} /><Summary value={goals.length} label="active goals" icon="↗" onClick={() => onNavigate('goals')} /></section>
    <div className="dashboard-grid"><div className="card home-card"><SectionHeader eyebrow="NEXT UP" title="Your tasks" action={openTasks.length ? 'View all' : '+ Add task'} onClick={() => openTasks.length ? onNavigate('tasks') : onAdd()} />{openTasks.length ? openTasks.slice(0, 4).map((task) => <TaskRow key={task.id} task={task} onToggle={() => onToggleTask(task.id)} />) : <EmptyState icon="✓" title="Nothing pressing." body="Add a task when something needs your attention." action="Add a task" onClick={onAdd} />}</div><div className="card home-card"><SectionHeader eyebrow="TODAY" title="Habit rhythm" action="See habits" onClick={() => onNavigate('habits')} />{habits.length ? habits.slice(0, 3).map((habit) => <HabitRow key={habit.id} habit={habit} onToggle={() => onToggleHabit(habit.id)} />) : <EmptyState icon="◌" title="Build a rhythm." body="A tiny daily practice can anchor the day." action="Create a habit" onClick={() => onNavigate('habits')} />}</div></div>
    <div className="card goal-strip"><SectionHeader eyebrow="IN MOTION" title="Your goals" action="See goals" onClick={() => onNavigate('goals')} />{goals.length ? <div className="goal-mini-list">{goals.slice(0, 3).map((goal) => <GoalProgress key={goal.id} goal={goal} compact />)}</div> : <p className="muted">Give a meaningful direction a place to live.</p>}</div>
  </div>;
}

function Tasks({ tasks, onAdd, onEdit, onDelete, onToggle }) {
  const [filter, setFilter] = useState('all');
  const visible = tasks.filter((task) => filter === 'all' || filter === (task.done ? 'done' : 'open'));
  return <div className="page"><PageIntro eyebrow="YOUR ATTENTION" title="Tasks" body="Make the next action visible. Keep the list kind and useful." action="+ New task" onClick={onAdd} /><div className="filter-row" role="group" aria-label="Task filter">{['all', 'open', 'done'].map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'all' ? 'All' : item === 'open' ? 'Open' : 'Completed'}</button>)}</div><div className="card list-card">{visible.length ? visible.map((task) => <TaskRow key={task.id} task={task} onToggle={() => onToggle(task.id)} onEdit={() => onEdit(task)} onDelete={() => onDelete(task.id)} detailed />) : <EmptyState icon="✓" title={filter === 'done' ? 'No completed tasks yet.' : 'A clear slate.'} body={filter === 'done' ? 'Completed tasks will collect here.' : 'Add one concrete next step to get started.'} action="Create a task" onClick={onAdd} />}</div></div>;
}

function Habits({ habits, onAdd, onEdit, onDelete, onToggle }) {
  return <div className="page"><PageIntro eyebrow="REPEAT WHAT HELPS" title="Habits" body="Consistency is a conversation, not a scorecard." action="+ New habit" onClick={onAdd} />{habits.length ? <div className="card list-card habit-list">{habits.map((habit) => <HabitRow key={habit.id} habit={habit} onToggle={() => onToggle(habit.id)} onEdit={() => onEdit(habit)} onDelete={() => onDelete(habit.id)} detailed />)}</div> : <div className="card empty-card"><EmptyState icon="◌" title="Start with one small rhythm." body="Whether it is water, a walk, or ten quiet minutes, give it a name." action="Create a habit" onClick={onAdd} /></div>}</div>;
}

function Goals({ goals, onAdd, onEdit, onDelete, onProgress }) {
  return <div className="page"><PageIntro eyebrow="A DIRECTION, NOT A DEADLINE" title="Goals" body="Track progress without losing sight of why it matters." action="+ New goal" onClick={onAdd} />{goals.length ? <div className="goals-grid">{goals.map((goal) => <div className="card goal-card" key={goal.id}><div className="item-actions"><span className="goal-tag">{goal.area || 'Personal'}</span><Actions onEdit={() => onEdit(goal)} onDelete={() => onDelete(goal.id)} /></div><h2>{goal.title}</h2><p>{goal.description || 'Keep moving at a sustainable pace.'}</p><GoalProgress goal={goal} onProgress={(value) => onProgress(goal.id, value)} /><div className="goal-deadline">{goal.deadline ? `Target · ${formatShortDate(goal.deadline)}` : 'No deadline set'}</div></div>)}</div> : <div className="card empty-card"><EmptyState icon="↗" title="What are you moving toward?" body="Set a goal that gives your everyday actions a little more meaning." action="Create a goal" onClick={onAdd} /></div>}</div>;
}

function Profile({ account, profile, onSave, onSignOut, onDelete }) {
  const [form, setForm] = useState(profile);
  const [confirm, setConfirm] = useState(false);
  const [section, setSection] = useState('');
  useEffect(() => setForm(profile), [profile]);
  return <div className="page"><PageIntro eyebrow="YOUR SPACE" title="Profile" body="Keep your account-backed workspace recognisably yours." /><div className="profile-grid"><div className="card profile-card"><div className="profile-heading"><span className="avatar large">{initials(form.name || account.name)}</span><div><h2>{form.name || account.name}</h2><p>{account.email}</p></div></div><form onSubmit={(event) => { event.preventDefault(); onSave({ ...form, name: form.name.trim() || account.name, email: account.email }); }}><label>Name<input value={form.name || ''} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Pronouns <span className="optional">optional</span><input value={form.pronouns || ''} onChange={(event) => setForm({ ...form, pronouns: event.target.value })} placeholder="e.g. she/her" /></label><label>Timezone<input value={form.timezone || ''} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></label><button className="primary-button" type="submit">Save profile</button></form></div><div className="settings-stack"><div className="card setting-card subscription"><span className="eyebrow compact">CURRENT PLAN</span><h2>Free workspace</h2><p>Your core workspace is synced through Supabase. Premium billing is not connected, so no features are falsely unlocked.</p><button className="secondary-button" disabled>Plans coming later</button></div><div className="card setting-card"><h2>Settings & information</h2><button className="setting-row" onClick={() => setSection(section === 'privacy' ? '' : 'privacy')}><span><strong>Privacy</strong><small>Storage and account details</small></span><b>→</b></button>{section === 'privacy' && <p className="setting-detail">Authentication is handled by Supabase Auth. Core tasks, habits, goals, and profile data are stored in Supabase. Local preferences and legacy compatibility data may remain in this browser. Clearing browser storage does not delete your Supabase account or remote workspace.</p>}<button className="setting-row" onClick={() => setSection(section === 'terms' ? '' : 'terms')}><span><strong>Terms & limitations</strong><small>Prototype disclosure</small></span><b>→</b></button>{section === 'terms' && <p className="setting-detail">LifeOps uses authenticated Supabase services, but some production features are still incomplete. Do not treat it as fully production-ready or as the sole record for critical health, financial, or safety decisions.</p>}<button className="signout-button" onClick={onSignOut}>Sign out</button></div><div className="card danger-card"><h2>Clear local data</h2><p>Remove local browser workspace data and sign out. This does not delete your Supabase account or remote data.</p>{confirm ? <div className="confirm-actions"><button className="danger-button" onClick={onDelete}>Clear local data</button><button className="secondary-button" onClick={() => setConfirm(false)}>Cancel</button></div> : <button className="danger-link" onClick={() => setConfirm(true)}>Clear local data</button>}</div></div></div></div>;
}

function Editor({ type, item, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => item || (type === 'tasks' ? { title: '', notes: '', due: '', done: false } : type === 'habits' ? { title: '', frequency: 'Daily', completions: {} } : { title: '', description: '', area: 'Personal', target: 10, progress: 0, deadline: '' }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const title = type === 'tasks' ? 'task' : type === 'habits' ? 'habit' : 'goal';
  const submit = async (event) => {
    event.preventDefault();
    if (saving || !form.title.trim()) return;
    setError('');
    setSaving(true);
    try {
      const saved = await onSave({ ...form, title: form.title.trim(), ...(type === 'goals' ? { target: Math.max(1, Number(form.target) || 1), progress: Number(form.progress) || 0 } : {}) });
      if (saved === false) setError(`Couldn't save that ${title}. Please try again.`);
      else onClose();
    } finally {
      setSaving(false);
    }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="editor-title"><div className="modal-header"><div><span className="eyebrow compact">{item ? 'EDIT' : 'NEW'}</span><h2 id="editor-title">{item ? `Edit ${title}` : `Create a ${title}`}</h2></div><button className="close-button" onClick={onClose} aria-label="Close">×</button></div><form onSubmit={submit}>{<label>{type === 'tasks' ? 'Task' : type === 'habits' ? 'Habit' : 'Goal'}<input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={type === 'tasks' ? 'What needs doing?' : type === 'habits' ? 'What do you want to repeat?' : 'What are you moving toward?'} /></label>}{type === 'tasks' && <><label>Notes <span className="optional">optional</span><textarea rows="3" value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="A little context"></textarea></label><label>Due date <span className="optional">optional</span><input type="date" value={form.due || ''} onChange={(event) => setForm({ ...form, due: event.target.value })} /></label></>}{type === 'habits' && <label>Cadence<select value={form.frequency || 'Daily'} onChange={(event) => setForm({ ...form, frequency: event.target.value })}><option>Daily</option><option>Weekdays</option><option>Weekly</option></select></label>}{type === 'goals' && <><label>Why it matters <span className="optional">optional</span><textarea rows="2" value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })}></textarea></label><div className="form-columns"><label>Area<select value={form.area || 'Personal'} onChange={(event) => setForm({ ...form, area: event.target.value })}><option>Personal</option><option>Work</option><option>Health</option><option>Learning</option><option>Money</option></select></label><label>Target<input type="number" min="1" value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} /></label></div><div className="form-columns"><label>Progress<input type="number" min="0" value={form.progress} onChange={(event) => setForm({ ...form, progress: event.target.value })} /></label><label>Deadline<input type="date" value={form.deadline || ''} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label></div></>}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions">{onDelete && <button type="button" className="danger-link" onClick={onDelete}>Delete</button>}<span></span><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>Save {title}</button></div></form></div></div>;
}

function Summary({ value, label, icon, onClick }) { return <button className="summary-card" onClick={onClick}><span>{icon}</span><strong>{value}</strong><small>{label}</small><b>→</b></button>; }
function SectionHeader({ eyebrow, title, action, onClick }) { return <div className="card-header"><div><span className="eyebrow compact">{eyebrow}</span><h2>{title}</h2></div>{action && <button className="text-link" onClick={onClick}>{action} <span>→</span></button>}</div>; }
function PageIntro({ eyebrow, title, body, action, onClick }) { return <section className="page-intro"><div><span className="eyebrow compact">{eyebrow}</span><h1>{title}</h1><p>{body}</p></div>{action && <button className="primary-button" onClick={onClick}>{action}</button>}</section>; }
function EmptyState({ icon, title, body, action, onClick }) { return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{body}</p>{action && <button className="secondary-button" onClick={onClick}>{action} <span>→</span></button>}</div>; }
function Actions({ onEdit, onDelete }) { return <div className="item-actions-buttons"><button onClick={onEdit} aria-label="Edit">Edit</button><button onClick={onDelete} aria-label="Delete">Delete</button></div>; }
function TaskRow({ task, onToggle, onEdit, onDelete, detailed }) { return <div className={`task-row ${task.done ? 'done' : ''}`}><button className="check-button" aria-label={task.done ? 'Mark task open' : 'Complete task'} onClick={onToggle}>{task.done ? '✓' : ''}</button><div className="row-copy"><strong>{task.title}</strong>{(task.notes || task.due) && <span>{task.notes || `Due ${formatShortDate(task.due)}`}</span>}</div>{task.due && task.notes && <small className="due-label">{formatShortDate(task.due)}</small>}{detailed && <Actions onEdit={onEdit} onDelete={onDelete} />}</div>; }
function HabitRow({ habit, onToggle, onEdit, onDelete, detailed }) { const completed = Boolean((habit.completions || {})[localDate()]); return <div className="habit-row"><button className={`check-button habit-check ${completed ? 'checked' : ''}`} aria-label={completed ? 'Undo today habit' : 'Complete habit for today'} onClick={onToggle}>{completed ? '✓' : ''}</button><div className="row-copy"><strong>{habit.title}</strong><span>{habit.frequency || 'Daily'} · <b>{streak(habit)} day streak</b></span></div>{detailed && <Actions onEdit={onEdit} onDelete={onDelete} />}</div>; }
function GoalProgress({ goal, compact }) { const percent = Math.min(100, Math.round((Number(goal.progress) / Math.max(1, Number(goal.target))) * 100)); return <div className={`goal-progress ${compact ? 'compact' : ''}`}><div className="progress-heading"><span>{goal.progress || 0} / {goal.target}</span><strong>{percent}%</strong></div><div className="progress-track"><span style={{ width: `${percent}%` }}></span></div></div>; }

function initials(name) { return (name || 'L').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
function firstName(name) { return (name || 'there').trim().split(/\s+/)[0] || 'there'; }
function formatDate() { return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()); }
function formatShortDate(value) { if (!value) return ''; return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`)); }
function streak(habit) { let count = 0; const completions = habit.completions || {}; const cursor = new Date(); while (completions[localDateFromDate(cursor)]) { count += 1; cursor.setDate(cursor.getDate() - 1); } return count; }
function localDateFromDate(date) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => console.error('LifeOps offline shell could not start.', error));
  });
}

createRoot(document.getElementById('root')).render(<AppErrorBoundary><App /></AppErrorBoundary>);
