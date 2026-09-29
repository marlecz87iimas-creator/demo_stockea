import { type FormEvent, useState } from 'react';
import { DEMO_LIMIT, DEMO_MODE } from '../demo/config';
import { useAuth } from '../auth/AuthContext';
import HomeRedirect from '../components/HomeRedirect';
import StockeaLogo from '../components/StockeaLogo';

export default function LoginPage() {
  const { session, login } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (session) return <HomeRedirect />;

  if (DEMO_MODE) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <StockeaLogo variant="login" />
            <p>Demo interactiva · sin registro</p>
          </div>
          <button
            type="button"
            className="btn btn-primary auth-submit"
            onClick={() => { login('', '').catch(() => {}); }}
          >
            Entrar a la demo
          </button>
          <p className="auth-hint">
            Hasta {DEMO_LIMIT} de cada recurso. Los datos se pierden al cerrar la página.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(usuario.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <StockeaLogo variant="login" />
          <p>Controla tu inventario con claridad</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-field auth-field">
            <label htmlFor="login-usuario">Usuario</label>
            <input
              id="login-usuario"
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Tu usuario o correo"
              autoComplete="username"
              required
            />
          </div>
          <div className="form-field auth-field">
            <label htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
            {submitting ? 'Espera…' : 'Entrar'}
          </button>
        </form>

        <p className="auth-hint">
          Conectado a Hildra Core · datos en la nube
        </p>
      </div>
    </div>
  );
}
