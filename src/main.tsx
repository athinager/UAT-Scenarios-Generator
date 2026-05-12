import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Note: StrictMode disabled due to react-beautiful-dnd compatibility issues with React 18
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
