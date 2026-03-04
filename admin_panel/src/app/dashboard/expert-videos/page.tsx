import { redirect } from 'next/navigation';

// Expert videos are now merged into Expert Requests (/dashboard/experts)
export default function ExpertVideosRedirect() {
  redirect('/dashboard/experts');
}
