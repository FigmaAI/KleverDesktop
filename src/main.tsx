import ReactDOM from 'react-dom/client'
import App from './App'
import '@siwc/react/styles.css'
import './index.css'
import './i18n'
import { installBrowserPreview } from './lib/browser-preview'

if (!window.electronAPI) installBrowserPreview()

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
