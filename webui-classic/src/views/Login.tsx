import { useState } from 'react';
import { load } from '../lib/storage';
import { useApp } from '../store/app';
import { login } from '../store/session';

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
