import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Home, Wallet, Gift, User, LogOut, ArrowRight, RefreshCcw } from 'lucide-react'
import { supabase } from './supabase'
import './styles.css'

const money = n => `$${Number(n || 0).toFixed(2)}`

function Auth({ onAuthed }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
  e.preventDefault()
  setBusy(true)
  setMsg('')

  try {
    let result

    if (mode === 'login') {
      result = await supabase.auth.signInWithPassword({
        email,
        password
      })
    } else {
      result = await supabase.auth.signUp({
        email,
        password
      })
    }

    const { data, error } = result

    if (error) {
      setMsg(error.message)
      return
    }

    if (data.session) {
      onAuthed(data.session)
    } else {
      setMsg('Account created. Check your email if confirmation is required.')
    }
  } catch (err) {
    setMsg(err?.message || 'Could not connect to Supabase.')
  } finally {
    setBusy(false)
  }
  }

  return <div className="auth-shell">
    <div className="brand-badge">E</div>
    <h1>Earn smarter.</h1>
    <p>Complete verified offers. Build your balance. Withdraw when ready.</p>
    <form className="auth-card" onSubmit={submit}>
      <div className="seg">
        <button type="button" className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Login</button>
        <button type="button" className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>Sign up</button>
      </div>
      <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Email" required />
      <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" minLength="6" required />
      <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}</button>
      {msg && <div className="notice">{msg}</div>}
    </form>
  </div>
}

function App() {
  const [session, setSession] = useState(null)
  const [tab, setTab] = useState('home')
  const [wallet, setWallet] = useState(null)
  const [offers, setOffers] = useState([])
  const [history, setHistory] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [loadingOffers, setLoadingOffers] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [upi, setUpi] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const user = session?.user

  const refreshData = async () => {
    if (!user) return
    const [{data:w},{data:h},{data:wd},{data:p}] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user.id).single(),
      supabase.from('offer_completions').select('*').eq('user_id', user.id).order('created_at',{ascending:false}).limit(20),
      supabase.from('withdrawals').select('*').eq('user_id', user.id).order('requested_at',{ascending:false}).limit(20),
      supabase.from('profiles').select('upi_id').eq('id', user.id).single()
    ])
    setWallet(w || {withdrawable_balance:0,pending_balance:0,lifetime_earned:0})
    setHistory(h || [])
    setWithdrawals(wd || [])
    if (p?.upi_id) setUpi(p.upi_id)
  }

  useEffect(() => { if (user) refreshData() }, [user?.id])

  const loadOffers = async () => {
    if (!session) return
    setLoadingOffers(true); setMessage('')
    const { data, error } = await supabase.functions.invoke('cpagrip-offers')
    setLoadingOffers(false)
    if (error) return setMessage(error.message)
    const arr = data?.offers || data || []
    setOffers(Array.isArray(arr) ? arr : [])
  }

  useEffect(() => { if (tab === 'earn' && offers.length === 0) loadOffers() }, [tab])

  const doWithdraw = async e => {
    e.preventDefault()
    setMessage('')
    const amount = Number(withdrawAmount)
    const { data, error } = await supabase.rpc('request_withdrawal', {
      p_amount_usd: amount,
      p_upi_id: upi
    })
    if (error) return setMessage(error.message)
    if (!data?.ok) return setMessage(data?.error || 'Withdrawal failed')
    setMessage(`Withdrawal requested: ${money(amount)}`)
    setWithdrawAmount('')
    refreshData()
  }

  if (!session) return <Auth onAuthed={setSession} />

  const nav = [
    ['home', Home, 'Home'],
    ['earn', Gift, 'Earn'],
    ['wallet', Wallet, 'Wallet'],
    ['profile', User, 'Profile'],
  ]

  return <div className="app">
    <header>
      <div>
        <span className="eyebrow">AVAILABLE</span>
        <strong>{money(wallet?.withdrawable_balance)}</strong>
      </div>
      <button className="icon-btn" onClick={refreshData}><RefreshCcw size={18}/></button>
    </header>

    <main>
      {message && <div className="notice">{message}</div>}

      {tab==='home' && <>
        <section className="hero-card">
          <span>Your balance</span>
          <h2>{money(wallet?.withdrawable_balance)}</h2>
          <p>{money(wallet?.pending_balance)} pending</p>
          <button className="primary" onClick={()=>setTab('earn')}>Start earning <ArrowRight size={18}/></button>
        </section>
        <div className="stats">
          <div><span>Lifetime</span><b>{money(wallet?.lifetime_earned)}</b></div>
          <div><span>Offers</span><b>{history.length}</b></div>
        </div>
        <h3>Recent activity</h3>
        <Activity history={history}/>
      </>}

      {tab==='earn' && <>
        <div className="section-head">
          <div><span className="eyebrow">DISCOVER</span><h2>Earn offers</h2></div>
          <button className="icon-btn" onClick={loadOffers}><RefreshCcw size={18}/></button>
        </div>
        {loadingOffers && <div className="empty">Loading offers…</div>}
        {!loadingOffers && offers.length===0 && <div className="empty">No offers available right now.</div>}
        <div className="offer-grid">
          {offers.map((o,i)=><OfferCard key={o.offerid || o.id || i} offer={o}/>)}
        </div>
      </>}

      {tab==='wallet' && <>
        <h2>Wallet</h2>
        <div className="wallet-grid">
          <div><span>Withdrawable</span><b>{money(wallet?.withdrawable_balance)}</b></div>
          <div><span>Pending</span><b>{money(wallet?.pending_balance)}</b></div>
          <div><span>Lifetime</span><b>{money(wallet?.lifetime_earned)}</b></div>
        </div>
        <form className="withdraw-card" onSubmit={doWithdraw}>
          <h3>Withdraw to UPI</h3>
          <input value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)} type="number" min="1" step="0.01" placeholder="Amount in USD" required/>
          <input value={upi} onChange={e=>setUpi(e.target.value)} placeholder="yourname@upi" required/>
          <button className="primary">Request withdrawal</button>
          <small>Minimum withdrawal is currently $1. Requests are manually reviewed.</small>
        </form>
        <h3>Withdrawals</h3>
        <div className="list">
          {withdrawals.map(w=><div className="row" key={w.id}><div><b>{money(w.amount_usd)}</b><span>{w.upi_id}</span></div><em className={`status ${w.status}`}>{w.status}</em></div>)}
        </div>
      </>}

      {tab==='profile' && <>
        <h2>Profile</h2>
        <div className="profile-card">
          <span>Signed in as</span>
          <b>{user.email}</b>
          <small>User ID: {user.id}</small>
          <button className="ghost danger" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/> Sign out</button>
        </div>
      </>}
    </main>

    <nav>
      {nav.map(([id,Icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={20}/><span>{label}</span></button>)}
    </nav>
  </div>
}

function OfferCard({ offer }) {
  const title = offer.title || offer.name || 'Offer'
  const desc = offer.description || offer.desc || offer.requirements || 'Complete this offer to earn.'
  const payout = offer.payout || offer.amount || offer.points || offer.epc || 0
  const image = offer.picture || offer.image || offer.icon || offer.thumbnail
  const link = offer.offerlink || offer.url || offer.link
  return <article className="offer-card">
    <div className="offer-top">
      {image ? <img src={image} alt="" /> : <div className="offer-fallback">★</div>}
      <div><h3>{title}</h3><p>{String(desc).slice(0,120)}</p></div>
    </div>
    <div className="offer-bottom">
      <div><span>Reward</span><b>{money(payout)}</b></div>
      <button className="primary small" disabled={!link} onClick={()=>link && window.open(link,'_blank','noopener,noreferrer')}>Start</button>
    </div>
  </article>
}

function Activity({history}) {
  if (!history.length) return <div className="empty">Your completed offers will appear here.</div>
  return <div className="list">
    {history.map(h=><div className="row" key={h.id}><div><b>Offer #{h.offer_id}</b><span>{new Date(h.created_at).toLocaleString()}</span></div><strong>+{money(h.user_reward_usd)}</strong></div>)}
  </div>
}

createRoot(document.getElementById('root')).render(<App/>)
