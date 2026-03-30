import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!showOtp) {
        if (email && password) {
          setShowOtp(true);
          setLoading(false);
          return;
        }
      } else {
        if (otp === '111111') {
          await signIn(email, password);
          setLocation('/');
        } else {
          setError('Invalid OTP code. Please enter 111111');
          setLoading(false);
          return;
        }
      }
    } catch (err: any) {
      let errorMessage = 'Failed to sign in';
      if (err.message?.includes('Invalid credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (err.message?.includes('Backend server is not running')) {
        errorMessage = 'Backend server is not running. Please start it with: npm run dev:server';
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gp-bg min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="gp-card w-full max-w-md border border-[var(--gp-border-gold)] bg-[rgba(6,13,26,0.86)]">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-gp-display font-bold text-center text-[var(--gp-white)]">Sign In</CardTitle>
          <CardDescription className="text-center font-gp-serif text-[color:var(--gp-muted)]">
            {showOtp ? 'Enter the 6-digit OTP code sent to your email' : 'Enter your email and password to access your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!showOtp ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-gp-sans text-[var(--gp-gold-bright)]">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-[var(--gp-border-gold)]/50 bg-[rgba(6,13,26,0.55)] text-[var(--gp-white)] placeholder:text-[color:var(--gp-subtle)] focus-visible:ring-[var(--gp-gold)]"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="font-gp-sans text-[var(--gp-gold-bright)]">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-[var(--gp-border-gold)]/50 bg-[rgba(6,13,26,0.55)] text-[var(--gp-white)] placeholder:text-[color:var(--gp-subtle)] focus-visible:ring-[var(--gp-gold)]"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="otp" className="font-gp-sans text-[var(--gp-gold-bright)]">OTP Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="border-[var(--gp-border-gold)]/50 bg-[rgba(6,13,26,0.55)] text-[var(--gp-white)] placeholder:text-[color:var(--gp-subtle)] focus-visible:ring-[var(--gp-gold)] text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowOtp(false);
                    setOtp('');
                    setError('');
                  }}
                  className="text-sm font-gp-sans text-[var(--gp-gold-dim)] hover:text-[var(--gp-gold-bright)] transition-colors w-full text-center"
                >
                  {'<- Back to login'}
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-gp-sans font-semibold tracking-[0.08em] uppercase"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {showOtp ? 'Verify OTP' : 'Continue'}
            </Button>
          </form>

          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={() => setLocation('/reset-password')}
              className="text-sm font-gp-sans text-[var(--gp-gold-dim)] hover:text-[var(--gp-gold-bright)] transition-colors"
            >
              Forgot your password?
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
