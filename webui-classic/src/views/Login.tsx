import { useEffect, useState } from 'react';
import { load } from '../lib/storage';
import { useApp } from '../store/app';
import { cancelResume, login } from '../store/session';

/** How long signing in with a saved login may take before the form is offered */
const OFFER_FORM_AFTER = 5000;

/** Shown instead of the form while a saved login is used. Without any fields, password managers stay quiet. */
export const SigningIn = () => {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), OFFER_FORM_AFTER);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="login">
      <div className="login-box">
        <h1 className="dialog-title">AirDC++ Classic</h1>
        <div className="dialog-body">
          <p role="status">Signing in…</p>
          {slow && <p className="muted">This takes longer than usual. The client may not be reachable.</p>}
        </div>
        {slow && (
          <div className="dialog-buttons">
            <button type="button" onClick={cancelResume}>
              Log in with password
            </button>
          </div>
        )}
      </div>
    </main>
  );
};

export const Login = () => {
  const connecting = useApp((s) => s.connection !== 'login');
  const error = useApp((s) => s.loginError);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => load('remember', false));

  return (
    <main className="login">
      <form
        className="login-box"
        onSubmit={(e) => {
          e.preventDefault();
          void login(username, password, remember);
        }}
      >
        <h1 className="dialog-title">AirDC++ Classic</h1>
        <div className="dialog-body">
          <label className="field">
            <span>Username</span>
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="check-field">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Keep me logged in
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-buttons">
          <button type="submit" disabled={connecting}>
            {connecting ? 'Connecting…' : 'Log in'}
          </button>
        </div>
      </form>
    </main>
  );
};
