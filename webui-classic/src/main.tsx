import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initAppIcon } from './store/appIcon';
import { resume } from './store/session';
import { initTheme } from './store/theme';
import './styles.css';

initTheme();
initAppIcon();

void resume();
createRoot(document.getElementById('root')!).render(<App />);
