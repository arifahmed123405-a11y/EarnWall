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
        Complete verified offers.
        Build your balance.
        Withdraw when ready.
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
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
        />

        <button className="primary" disabled={busy}>
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
  const [lootwallsHistory, setLootwallsHistory] = useState([])
  const [offerActivity, setOfferActivity] = useState([])
  const [withdrawals, setWithdrawals] = useState([])

  const [lootwallsOffers, setLootwallsOffers] = useState([])
  const [cpxOffers, setCpxOffers] = useState([])
  const [loadingOffers, setLoadingOffers] = useState(false)
  const [offerError, setOfferError] = useState('')

  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [upi, setUpi] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  const user = session?.user

  const refreshData = async () => {
    if (!user) return

    const [
      walletResult,
      lootwallsResult,
      activityResult,
      withdrawalResult,
      profileResult
    ] = await Promise.all([
      supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single(),

      supabase
        .from('lootwalls_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),

      supabase
        .from('offer_activity')
        .select('*')
        .eq('user_id', user.id)
        .in('network', ['Lootwalls', 'CPX Research'])
        .order('created_at', { ascending: false })
        .limit(50),

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

    if (walletResult.data) setWallet(walletResult.data)
    setLootwallsHistory(lootwallsResult.data || [])
    setOfferActivity(activityResult.data || [])
    setWithdrawals(withdrawalResult.data || [])

    if (profileResult.data?.upi_id) {
      setUpi(profileResult.data.upi_id)
    }
  }

  const normalizeLootwalls = list =>
    list.map((offer, index) => ({
      ...offer,
      _provider: 'Lootwalls',
      _key: `lootwalls-${offer.id || offer.offerId || offer.offer_id || index}`,
      _title:
        offer.title ||
        offer.name ||
        offer.offerName ||
        offer.offer_name ||
        'Lootwalls Offer',
      _description:
        offer.description ||
        offer.instructions ||
        offer.requirements ||
        offer.shortDescription ||
        'Complete this offer to earn a reward.',
      _image:
        offer.image ||
        offer.imageUrl ||
        offer.icon ||
        offer.thumbnail ||
        offer.logo,
      _reward:
        offer.reward ??
        offer.userReward ??
        offer.amount ??
        offer.payout ??
        0,
      _category: offer.category || offer.type || 'Offer',
      _url:
        offer.entryUrl ||
        offer.entry_url ||
        offer.trackingUrl ||
        offer.tracking_url ||
        offer.url,
      _offerId:
        offer.id ||
        offer.offerId ||
        offer.offer_id ||
        `lootwalls-${index}`
    }))

  const normalizeCpx = list =>
    list.map((survey, index) => ({
      ...survey,
      _provider: 'CPX Research',
      _key: `cpx-${survey.id || index}`,
      _title: `Paid Survey #${survey.id || index + 1}`,
      _description: [
        survey.loi ? `${survey.loi} min` : null,
        survey.conversion_rate
          ? `${survey.conversion_rate}% conversion`
          : null,
        Number(survey.webcam || 0) === 1 ? 'Webcam required' : null
      ]
        .filter(Boolean)
        .join(' · '),
      _image: null,
      _reward: survey.payout ?? 0,
      _category:
        Number(survey.top || 0) === 1
          ? 'Top survey'
          : 'Survey',
      _url: survey.href_new || survey.href || survey.url,
      _offerId: survey.id || `cpx-${index}`
    }))

  const loadOffers = async () => {
    if (!session) return

    setLoadingOffers(true)
    setOfferError('')

    const errors = []

    try {
      const [lootwallsResult, cpxResult] = await Promise.allSettled([
        supabase.functions.invoke('lootwalls-offers'),
        supabase.functions.invoke('cpx-surveys')
      ])

      if (lootwallsResult.status === 'fulfilled') {
        const { data, error } = lootwallsResult.value

        if (error) {
          console.error('Lootwalls error:', error)
          errors.push('Lootwalls unavailable')
          setLootwallsOffers([])
        } else {
          const list =
            data?.offers ||
            data?.data ||
            data?.results ||
            (Array.isArray(data) ? data : [])

          setLootwallsOffers(
            normalizeLootwalls(Array.isArray(list) ? list : [])
          )
        }
      } else {
        console.error('Lootwalls request failed:', lootwallsResult.reason)
        errors.push('Lootwalls unavailable')
        setLootwallsOffers([])
      }

      if (cpxResult.status === 'fulfilled') {
        const { data, error } = cpxResult.value

        if (error) {
          console.error('CPX error:', error)
          errors.push('CPX unavailable')
          setCpxOffers([])
        } else {
          const list = data?.surveys || data?.data?.surveys || []

          if (data?.status && data.status !== 'success') {
            console.error('CPX returned:', data)
            errors.push('CPX unavailable')
          }

          setCpxOffers(
            normalizeCpx(Array.isArray(list) ? list : [])
          )
        }
      } else {
        console.error('CPX request failed:', cpxResult.reason)
        errors.push('CPX unavailable')
        setCpxOffers([])
      }

      if (errors.length === 2) {
        setOfferError('Could not load earning opportunities right now.')
      } else if (errors.length === 1) {
        setOfferError(`${errors[0]}. Other available opportunities are shown below.`)
      }
    } catch (err) {
      console.error(err)
      setOfferError(err?.message || 'Could not load offers.')
    } finally {
      setLoadingOffers(false)
    }
  }

  useEffect(() => {
    if (user) refreshData()
  }, [user?.id])

  useEffect(() => {
    if (
      tab === 'earn' &&
      lootwallsOffers.length === 0 &&
      cpxOffers.length === 0
    ) {
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
      setMessage(data?.error || 'Withdrawal failed.')
      return
    }

    setMessage(`Withdrawal requested: ${money(amount)}`)
    setWithdrawAmount('')
    refreshData()
  }

  if (!session) return <Auth onAuthed={setSession} />

  const nav = [
    ['home', Home, 'Home'],
    ['earn', Gift, 'Earn'],
    ['wallet', Wallet, 'Wallet'],
    ['profile', User, 'Profile']
  ]

  const startedHistory = offerActivity.map(item => ({
    id: `started-${item.id}`,
    offerId: String(item.offer_id || ''),
    title: item.offer_name || `${item.network || 'Offer'} activity`,
    reward: item.reward,
    status: item.status || 'started',
    created_at: item.created_at,
    source: item.network || 'Offer'
  }))

  const completedOfferIds = new Set(
    lootwallsHistory
      .map(item => String(item.offer_id || ''))
      .filter(Boolean)
  )

  const filteredStarted = startedHistory.filter(item => {
    if (item.source !== 'Lootwalls') return true

    return !item.offerId || !completedOfferIds.has(item.offerId)
  })

  const conversionHistory = lootwallsHistory.map(item => ({
    id: `lootwalls-${item.transaction_id || item.id}`,
    offerId: String(item.offer_id || ''),
    title: item.offer_name || 'Lootwalls reward',
    reward:
      item.user_reward ??
      item.reward ??
      item.payout_usd ??
      item.payout ??
      0,
    status: item.status || 'confirmed',
    created_at: item.created_at,
    source: 'Lootwalls'
  }))

  const combinedHistory = [
    ...filteredStarted,
    ...conversionHistory
  ]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )
    .slice(0, 30)

  const seenOffers = new Set()

  const mergedOffers = [...cpxOffers, ...lootwallsOffers].filter(offer => {
    const key = `${offer._provider}:${offer._offerId}`

    if (seenOffers.has(key)) return false

    seenOffers.add(key)
    return true
  })

  return (
    <div className="app">
      <header>
        <div>
          <span className="eyebrow">AVAILABLE</span>
          <strong>{money(wallet?.withdrawable_balance)}</strong>
        </div>

        <button
          className="icon-btn"
          onClick={refreshData}
          aria-label="Refresh account"
        >
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

              <button className="primary" onClick={() => setTab('earn')}>
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
                <span>Activity</span>
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
                <span className="eyebrow">LOOTWALLS + CPX RESEARCH</span>
                <h2>Earn opportunities</h2>
              </div>

              <button
                className="icon-btn"
                onClick={loadOffers}
                disabled={loadingOffers}
                aria-label="Refresh offers"
              >
                <RefreshCcw size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <span className="eyebrow">CPX {cpxOffers.length}</span>
              <span className="eyebrow">LOOTWALLS {lootwallsOffers.length}</span>
              <span className="eyebrow">TOTAL {mergedOffers.length}</span>
            </div>

            {loadingOffers && <div className="empty">Loading opportunities…</div>}
            {offerError && <div className="notice">{offerError}</div>}

            {!loadingOffers && mergedOffers.length === 0 && (
              <div className="empty">No earning opportunities available right now.</div>
            )}

            <div className="offer-grid">
              {mergedOffers.map(offer => (
                <OfferCard
                  key={offer._key}
                  offer={offer}
                  user={user}
                  onStarted={refreshData}
                />
              ))}
            </div>

            <p style={{ opacity: 0.65, fontSize: '12px', marginTop: '12px' }}>
              Rewards are credited only after the provider confirms a genuine completion.
              Starting or clicking an opportunity does not add money to your wallet.
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

              <button className="primary">Request withdrawal</button>

              <small>
                Minimum withdrawal is currently $1. Requests are manually reviewed.
              </small>
            </form>

            <h3>Withdrawals</h3>

            <div className="list">
              {withdrawals.length === 0 && (
                <div className="empty">No withdrawal requests yet.</div>
              )}

              {withdrawals.map(w => (
                <div className="row" key={w.id}>
                  <div>
                    <b>{money(w.amount_usd)}</b>
                    <span>{w.upi_id}</span>
                  </div>

                  <em className={`status ${w.status}`}>{w.status}</em>
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
              <small>User ID: {user.id}</small>

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

function OfferCard({ offer, user, onStarted }) {
  const title = offer._title || offer.title || offer.name || 'Earning opportunity'
  const description = offer._description || offer.description || 'Complete this opportunity to earn a reward.'
  const image = offer._image || offer.image || offer.imageUrl || offer.icon
  const reward = offer._reward ?? offer.reward ?? offer.payout ?? 0
  const category = offer._category || offer.category || offer.type || ''
  const trackingUrl = offer._url || offer.href_new || offer.href || offer.entryUrl || offer.trackingUrl || offer.url
  const offerId = offer._offerId || offer.id || offer.offerId || title
  const network = offer._provider || offer.network || 'Unknown'

  const startOffer = async () => {
    if (!trackingUrl || !user) return

    const { error } = await supabase
      .from('offer_activity')
      .insert({
        user_id: user.id,
        offer_id: String(offerId),
        offer_name: title,
        reward: Number(reward || 0),
        currency: 'USD',
        network,
        tracking_url: trackingUrl,
        status: 'started'
      })

    if (error) {
      console.error('Could not save started offer:', error)
    } else {
      await onStarted?.()
    }

    window.open(trackingUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <article className="offer-card">
      <div className="offer-top">
        {image ? (
          <img src={image} alt="" loading="lazy" />
        ) : (
          <div className="offer-fallback">
            {network === 'CPX Research' ? '✓' : '★'}
          </div>
        )}

        <div>
          <h3>{title}</h3>
          <p>{String(description).slice(0, 150)}</p>
          <small>
            {network}
            {category ? ` · ${category}` : ''}
          </small>
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
          onClick={startOffer}
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
    return <div className="empty">No activity yet.</div>
  }

  return (
    <div className="list">
      {history.map(item => {
        const status = String(item.status || 'started').toLowerCase()
        const isConfirmed = ['confirmed', 'approved', 'completed', 'paid'].includes(status)
        const isReversed = ['reversed', 'rejected', 'cancelled', 'canceled'].includes(status)

        return (
          <div className="row" key={item.id}>
            <div>
              <b>{item.title}</b>
              <span>{item.source}</span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <b>
                {isReversed
                  ? `-${money(item.reward)}`
                  : isConfirmed
                  ? `+${money(item.reward)}`
                  : money(item.reward)}
              </b>
              <span>{status}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
