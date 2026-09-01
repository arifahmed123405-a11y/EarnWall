
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Home,
  Wallet,
  Gift,
  User,
  LogOut,
  ArrowRight,
  RefreshCcw,
  ExternalLink
} from 'lucide-react'
import { supabase } from './supabase'
import './styles.css'

const money = n => `$${Number(n || 0).toFixed(2)}`

function Auth({ onAuthed }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    setMsg('')

    try {
      const result =
        mode === 'login'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password })

      const { data, error } = result

      if (error) {
        setMsg(error.message)
        return
      }

      if (data.session) {
        onAuthed(data.session)
      } else {
        setMsg('Account created. Check your email if confirmation is enabled.')
      }
    } catch (err) {
      console.error(err)
      setMsg(err?.message || 'Could not connect to Supabase.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="brand-badge">E</div>

      <h1>Earn smarter.</h1>

      <p>
        Complete verified offers. Build your balance. Withdraw when ready.
      </p>

      <form className="auth-card" onSubmit={submit}>
        <div className="seg">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login')
              setMsg('')
            }}
          >
            Login
          </button>

          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => {
              setMode('signup')
              setMsg('')
            }}
          >
            Sign up
          </button>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />

        <button className="primary" type="submit" disabled={busy}>
          {busy
            ? 'Please wait…'
            : mode === 'login'
            ? 'Login'
            : 'Create account'}
        </button>

        {msg && <div className="notice">{msg}</div>}
      </form>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [tab, setTab] = useState('home')

  const [wallet, setWallet] = useState(null)
  const [cpagripHistory, setCpagripHistory] = useState([])
  const [offerwallHistory, setOfferwallHistory] = useState([])
  const [withdrawals, setWithdrawals] = useState([])

  const [offers, setOffers] = useState([])
  const [loadingOffers, setLoadingOffers] = useState(false)
  const [offerError, setOfferError] = useState('')

  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [upi, setUpi] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
      }
    )

    return () => sub.subscription.unsubscribe()
  }, [])

  const user = session?.user

  const refreshData = async () => {
    if (!user) return

    const [
      { data: walletData },
      { data: cpagripData },
      { data: offerwallData },
      { data: withdrawalData },
      { data: profileData }
    ] = await Promise.all([
      supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single(),

      supabase
        .from('offer_completions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),

      supabase
        .from('offerwallad_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),

      supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(20),

      supabase
        .from('profiles')
        .select('upi_id')
        .eq('id', user.id)
        .single()
    ])

    setWallet(
      walletData || {
        withdrawable_balance: 0,
        pending_balance: 0,
        lifetime_earned: 0
      }
    )

    setCpagripHistory(cpagripData || [])
    setOfferwallHistory(offerwallData || [])
    setWithdrawals(withdrawalData || [])

    if (profileData?.upi_id) {
      setUpi(profileData.upi_id)
    }
  }

  const loadOffers = async () => {
    if (!session) return

    setLoadingOffers(true)
    setOfferError('')

    try {
      const { data, error } = await supabase.functions.invoke(
        'offerwallad-offers'
      )

      if (error) {
        setOfferError(error.message)
        return
      }

      const arr =
        data?.offers ||
        data?.data ||
        data?.results ||
        (Array.isArray(data) ? data : [])

      setOffers(Array.isArray(arr) ? arr : [])
    } catch (err) {
      console.error(err)
      setOfferError(err?.message || 'Could not load offers.')
    } finally {
      setLoadingOffers(false)
    }
  }

  useEffect(() => {
    if (user) {
      refreshData()
    }
  }, [user?.id])

  useEffect(() => {
    if (tab === 'earn' && offers.length === 0) {
      loadOffers()
    }
  }, [tab])

  const doWithdraw = async e => {
    e.preventDefault()
    setMessage('')

    const amount = Number(withdrawAmount)

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Enter a valid withdrawal amount.')
      return
    }

    const { data, error } = await supabase.rpc('request_withdrawal', {
      p_amount_usd: amount,
      p_upi_id: upi
    })

    if (error) {
      setMessage(error.message)
      return
    }

    if (!data?.ok) {
      setMessage(data?.error || 'Withdrawal failed')
      return
    }

    setMessage(`Withdrawal requested: ${money(amount)}`)
    setWithdrawAmount('')
    refreshData()
  }

  if (!session) {
    return <Auth onAuthed={setSession} />
  }

  const nav = [
    ['home', Home, 'Home'],
    ['earn', Gift, 'Earn'],
    ['wallet', Wallet, 'Wallet'],
    ['profile', User, 'Profile']
  ]

  const combinedHistory = [
    ...cpagripHistory.map(item => ({
      id: `cpagrip-${item.id}`,
      title: `Offer #${item.offer_id}`,
      reward: item.user_reward_usd,
      status: item.status,
      created_at: item.created_at,
      source: 'CPAGrip'
    })),

    ...offerwallHistory.map(item => ({
      id: `offerwall-${item.transaction_id}`,
      title: item.offer_name || `Offer #${item.offer_id || 'Unknown'}`,
      reward: item.user_reward,
      status: item.status,
      created_at: item.created_at,
      source: 'Offerwall.ad'
    }))
  ]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )
    .slice(0, 20)

  return (
    <div className="app">
      <header>
        <div>
          <span className="eyebrow">AVAILABLE</span>
          <strong>{money(wallet?.withdrawable_balance)}</strong>
        </div>

        <button className="icon-btn" onClick={refreshData}>
          <RefreshCcw size={18} />
        </button>
      </header>

      <main>
        {message && <div className="notice">{message}</div>}

        {tab === 'home' && (
          <>
            <section className="hero-card">
              <span>Your balance</span>
              <h2>{money(wallet?.withdrawable_balance)}</h2>
              <p>{money(wallet?.pending_balance)} pending</p>

              <button
                className="primary"
                onClick={() => setTab('earn')}
              >
                Start earning
                <ArrowRight size={18} />
              </button>
            </section>

            <div className="stats">
              <div>
                <span>Lifetime</span>
                <b>{money(wallet?.lifetime_earned)}</b>
              </div>

              <div>
                <span>Offers</span>
                <b>{combinedHistory.length}</b>
              </div>
            </div>

            <h3>Recent activity</h3>

            <Activity history={combinedHistory} />
          </>
        )}

        {tab === 'earn' && (
          <>
            <div className="section-head">
              <div>
                <span className="eyebrow">DISCOVER</span>
                <h2>Earn offers</h2>
              </div>

              <button
                className="icon-btn"
                onClick={loadOffers}
                disabled={loadingOffers}
              >
                <RefreshCcw size={18} />
              </button>
            </div>

            {loadingOffers && (
              <div className="empty">
                Loading offers…
              </div>
            )}

            {offerError && (
              <div className="notice">
                {offerError}
              </div>
            )}

            {!loadingOffers &&
              !offerError &&
              offers.length === 0 && (
                <div className="empty">
                  No offers available right now.
                </div>
              )}

            <div className="offer-grid">
              {offers.map((offer, index) => (
                <OfferCard
                  key={
                    offer.id ||
                    offer.offer_id ||
                    offer.offerId ||
                    index
                  }
                  offer={offer}
                />
              ))}
            </div>

            <p
              style={{
                opacity: 0.65,
                fontSize: '12px',
                marginTop: '12px'
              }}
            >
              Rewards are credited only after the advertiser confirms completion.
            </p>
          </>
        )}

        {tab === 'wallet' && (
          <>
            <h2>Wallet</h2>

            <div className="wallet-grid">
              <div>
                <span>Withdrawable</span>
                <b>{money(wallet?.withdrawable_balance)}</b>
              </div>

              <div>
                <span>Pending</span>
                <b>{money(wallet?.pending_balance)}</b>
              </div>

              <div>
                <span>Lifetime</span>
                <b>{money(wallet?.lifetime_earned)}</b>
              </div>
            </div>

            <form className="withdraw-card" onSubmit={doWithdraw}>
              <h3>Withdraw to UPI</h3>

              <input
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                type="number"
                min="1"
                step="0.01"
                placeholder="Amount in USD"
                required
              />

              <input
                value={upi}
                onChange={e => setUpi(e.target.value)}
                placeholder="yourname@upi"
                required
              />

              <button className="primary">
                Request withdrawal
              </button>

              <small>
                Minimum withdrawal is currently $1. Requests are manually reviewed.
              </small>
            </form>

            <h3>Withdrawals</h3>

            <div className="list">
              {withdrawals.length === 0 && (
                <div className="empty">
                  No withdrawal requests yet.
                </div>
              )}

              {withdrawals.map(w => (
                <div className="row" key={w.id}>
                  <div>
                    <b>{money(w.amount_usd)}</b>
                    <span>{w.upi_id}</span>
                  </div>

                  <em className={`status ${w.status}`}>
                    {w.status}
                  </em>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'profile' && (
          <>
            <h2>Profile</h2>

            <div className="profile-card">
              <span>Signed in as</span>

              <b>{user.email}</b>

              <small>
                User ID: {user.id}
              </small>

              <button
                className="ghost danger"
                onClick={() => supabase.auth.signOut()}
              >
                <LogOut size={18} />
                Sign out
              </button>
            </div>
          </>
        )}
      </main>

      <nav>
        {nav.map(([id, Icon, label]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function OfferCard({ offer }) {
  const title =
    offer.title ||
    offer.name ||
    offer.offer_name ||
    'Offer'

  const description =
    offer.description ||
    offer.requirements ||
    offer.instructions ||
    offer.short_description ||
    'Complete this offer to earn a reward.'

  const image =
    offer.image ||
    offer.icon ||
    offer.thumbnail ||
    offer.logo

  const reward =
    offer.reward ??
    offer.reward_amount ??
    offer.amount ??
    offer.payout ??
    0

  const network =
    offer.network ||
    offer.provider ||
    offer.source ||
    ''

  const category =
    offer.category ||
    offer.type ||
    offer.offer_type ||
    ''

  const trackingUrl =
    offer.tracking_url ||
    offer.trackingUrl ||
    offer.click_url ||
    offer.clickUrl ||
    offer.url ||
    offer.link

  return (
    <article className="offer-card">
      <div className="offer-top">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
          />
        ) : (
          <div className="offer-fallback">
            ★
          </div>
        )}

        <div>
          <h3>{title}</h3>

          <p>
            {String(description).slice(0, 140)}
          </p>

          {(network || category) && (
            <small>
              {[network, category]
                .filter(Boolean)
                .join(' · ')}
            </small>
          )}
        </div>
      </div>

      <div className="offer-bottom">
        <div>
          <span>Reward</span>
          <b>{money(reward)}</b>
        </div>

        <button
          className="primary small"
          disabled={!trackingUrl}
          onClick={() => {
            if (!trackingUrl) return

            window.open(
              trackingUrl,
              '_blank',
              'noopener,noreferrer'
            )
          }}
        >
          Start
          <ExternalLink size={15} />
        </button>
      </div>
    </article>
  )
}

function Activity({ history }) {
  if (!history.length) {
    return (
      <div className="empty">
        Your completed offers will appear here.
      </div>
    )
  }

  const rewardText = item => {
    const amount = money(item.reward)

    if (
      item.status === 'reversed' ||
      item.status === 'rejected'
    ) {
      return `-${amount}`
    }

    if (
      item.status === 'held' ||
      item.status === 'pending'
    ) {
      return `Pending ${amount}`
    }

    return `+${amount}`
  }

  return (
    <div className="list">
      {history.map(item => (
        <div className="row" key={item.id}>
          <div>
            <b>{item.title}</b>

            <span>
              {item.source} · {item.status} ·{' '}
              {new Date(
                item.created_at
              ).toLocaleString()}
            </span>
          </div>

          <strong>
            {rewardText(item)}
          </strong>
        </div>
      ))}
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <App />
)
