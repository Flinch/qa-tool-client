import { SignIn } from '@clerk/clerk-react'

export default function SignInPage() {
  return (
    <div className="auth-page">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        <div>
          <div className="auth-logo">QA<span>Tool</span></div>
          <div className="auth-sub">Test case management & bug tracking</div>
        </div>
        <SignIn
          routing="hash"
          appearance={{
            variables: {
              colorPrimary: '#e07d3c',
              colorBackground: '#141824',
              colorInputBackground: '#111827',
              colorText: '#e8ecf4',
              colorTextSecondary: '#8a8fa8',
              borderRadius: '8px',
            },
            elements: {
              card: { border: '1px solid rgba(255,255,255,0.07)', boxShadow: 'none' },
              formButtonPrimary: { background: '#e07d3c', '&:hover': { background: '#f09150' } },
            }
          }}
        />
      </div>
    </div>
  )
}
