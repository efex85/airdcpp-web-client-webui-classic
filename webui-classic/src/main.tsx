import { createRoot } from 'react-dom/client';
import { App } from './App';
import { resume } from './store/session';
import { initTheme } from './store/theme';
import './styles.css';

initTheme();

void resume();
createRoot(document.getElementById('root')!).render(<App />);
