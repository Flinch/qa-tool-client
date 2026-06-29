// import { useEffect } from 'react'
// import { useNavigate } from 'react-router-dom'

// export default function SignInPage() {
//   const { isSignedIn, isLoaded } = useAuth()
//   const navigate = useNavigate()

//   useEffect(() => {
//     if (isLoaded && isSignedIn) {
//       navigate('/')
//       return
//     }
//     if (isLoaded && !isSignedIn) {
//       const redirectUrl = window.location.origin
//       window.location.href = `https://darling-alpaca-34.accounts.dev/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`
//     }
//   }, [isLoaded, isSignedIn])

//   return (
//     <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
//       <div style={{ textAlign: 'center' }}>
//         <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--white)', marginBottom: '0.5rem' }}>
//           QA<span style={{ color: 'var(--accent)' }}>Tool</span>
//         </div>
//         <div style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>Redirecting to sign in...</div>
//       </div>
//     </div>
//   )
// }