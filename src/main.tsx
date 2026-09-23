import {createRoot} from 'react-dom/client';
import {Provider} from './state';
import App from './App';
import {AuthProvider,useAuth} from './auth';
import './styles.css';
function Workspace(){const {session}=useAuth();const key=session?`ncg:user:${session.user.id}:v1`:'ncg:v1';return <Provider key={key} storageKey={key}><App/></Provider>;}
createRoot(document.getElementById('root')!).render(<AuthProvider><Workspace/></AuthProvider>);
if(import.meta.env.PROD&&'serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
