import './Toast.css';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
}

function Toast({ message, type }: ToastProps) {
  return (
    <div className={`toast toast-${type}`} role="alert" aria-live="polite">
      {message}
    </div>
  );
}

export default Toast;
