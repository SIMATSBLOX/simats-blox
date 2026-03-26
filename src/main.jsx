import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// StrictMode is off: Blockly inject/dispose remounts in StrictMode and can leave
// stale workspace refs, which throws during codegen and blanks the screen.
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />,
);
