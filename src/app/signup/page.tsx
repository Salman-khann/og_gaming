import { AuthForm } from '@/components/AuthForm';
import { Navbar } from '@/components/Navbar';
export default function SignupPage() {
  return (
    <>
      <Navbar />
      <AuthForm mode="signup" />
    </>
  );
}
