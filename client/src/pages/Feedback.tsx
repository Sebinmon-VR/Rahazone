import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/ui';
import FeedbackThread from '../components/FeedbackThread';

export default function FeedbackPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  return (
    <div>
      <PageHeader title="Feedback" subtitle={isAdmin ? 'Everything shareholders have posted across projects and units. Reply inline.' : 'Feedback on the projects you hold. Post new feedback from a project or unit page.'} />
      <FeedbackThread showContext />
    </div>
  );
}
