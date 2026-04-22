import { useToast } from '../context/ToastContext.jsx';

export default function Toast() {
  const { toast } = useToast();

  return (
    <div className={`toast ${toast ? 'show' : ''} ${toast?.type === 'error' ? 'error' : ''}`}>
      {toast?.msg}
    </div>
  );
}
