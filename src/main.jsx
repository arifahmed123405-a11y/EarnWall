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
  ExternalLink,
  ShieldCheck
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
  const [cpxTransactions, setCpxTransactions] = useState([])
  const [cpxOutcomes, setCpxOutcomes] = useState([])
  const [offerActivity, setOfferActivity] = useState([])
  const [withdrawals, setWithdrawals] = useState([])

  const [lootwallsOffers, setLootwallsOffers] = useState([])
  const [cpxOffers, setCpxOffers] = useState([])
  const [offerwallAdOffers, setOfferwallAdOffers] = useState([])
  const [cpaGripOffers, setCpaGripOffers] = useState([])
  const [providerFilter, setProviderFilter] = useState('all')
  const [loadingOffers, setLoadingOffers] = useState(false)
  const [offerError, setOfferError] = useState('')

  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [upi, setUpi] = useState('')
  const [message, setMessage] = useState('')
  const [messageTab, setMessageTab] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminWithdrawals, setAdminWithdrawals] = useState([])
  const [adminBusy, setAdminBusy] = useState(false)

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
      cpxTransactionsResult,
      cpxOutcomesResult,
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
        .from('cpx_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),

      supabase
        .from('cpx_outcome_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),

      supabase
        .from('offer_activity')
        .select('*')
        .eq('user_id', user.id)
        .in('network', ['Lootwalls', 'CPX Research', 'Offerwall.ad', 'CPAGrip'])
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
    setCpxTransactions(cpxTransactionsResult.data || [])
    setCpxOutcomes(cpxOutcomesResult.data || [])
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


  const normalizeOfferwallAd = list =>
    list.map((offer, index) => ({
      ...offer,
      _provider: 'Offerwall.ad',
      _key: `offerwallad-${offer.id || index}`,
      _title: offer.title || offer.name || 'Offerwall.ad offer',
      _description: offer.description || 'Complete this offer exactly as instructed.',
      _image: offer.image || offer.icon || offer.thumbnail || offer.logo,
      _reward: offer.reward ?? offer.user_reward ?? offer.payout ?? 0,
      _category: offer.category || offer.type || 'Offer',
      _url: offer.tracking_url || offer.trackingUrl || offer.url,
      _offerId: offer.id || `offerwallad-${index}`
    }))

  const normalizeCpaGrip = list =>
    list.map((offer, index) => ({
      ...offer,
      _provider: 'CPAGrip',
      _key: `cpagrip-${offer.id || index}`,
      _title: offer.title || 'CPAGrip offer',
      _description: offer.description || 'Complete this offer exactly as instructed.',
      _image: offer.image || offer.picture || offer.icon,
      _reward: offer.payout ?? offer.reward ?? 0,
      _category: offer.type || offer.offer_type || 'Offer',
      _url: offer.url || offer.offerlink,
      _offerId: offer.id || `cpagrip-${index}`
    }))

  const loadOffers = async () => {
    if (!session) return

    setLoadingOffers(true)
    setOfferError('')
    const errors = []

    try {
      const [lootwallsResult, cpxResult, offerwallAdResult, cpaGripResult] =
        await Promise.allSettled([
          supabase.functions.invoke('lootwalls-offers'),
          supabase.functions.invoke('cpx-surveys'),
          supabase.functions.invoke('offerwallad-offers'),
          supabase.functions.invoke('cpagrip-offers')
        ])

      const unpack = (result, name, setter, normalizer) => {
        if (result.status !== 'fulfilled') {
          console.error(`${name} failed:`, result.reason)
          errors.push(name)
          setter([])
          return
        }

        const { data, error } = result.value
        if (error) {
          console.error(`${name} error:`, error)
          errors.push(name)
          setter([])
          return
        }

        let list =
          data?.offers ||
          data?.surveys ||
          data?.data?.surveys ||
          data?.data ||
          data?.results ||
          (Array.isArray(data) ? data : [])

        setter(normalizer(Array.isArray(list) ? list : []))
      }

      unpack(lootwallsResult, 'Lootwalls', setLootwallsOffers, normalizeLootwalls)
      unpack(cpxResult, 'CPX', setCpxOffers, normalizeCpx)
      unpack(offerwallAdResult, 'Offerwall.ad', setOfferwallAdOffers, normalizeOfferwallAd)
      unpack(cpaGripResult, 'CPAGrip', setCpaGripOffers, normalizeCpaGrip)

      if (errors.length === 4) {
        setOfferError('Could not load earning opportunities right now.')
      } else if (errors.length) {
        setOfferError(`${errors.join(', ')} unavailable. Other providers are shown below.`)
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
    if (!user) {
      setIsAdmin(false)
      return
    }

    const checkAdmin = async () => {
      const { data, error } = await supabase.functions.invoke(
        'withdrawal-admin',
        {
          body: { action: 'list' }
        }
      )

      if (error || !data?.ok) {
        setIsAdmin(false)
        return
      }

      setIsAdmin(true)
      setAdminWithdrawals(data.withdrawals || [])
    }

    checkAdmin()
  }, [user?.id])

  const loadAdminWithdrawals = async () => {
    if (!isAdmin) return

    setAdminBusy(true)

    const { data, error } = await supabase.functions.invoke(
      'withdrawal-admin',
      {
        body: { action: 'list' }
      }
    )

    if (!error && data?.ok) {
      setAdminWithdrawals(data.withdrawals || [])
    }

    setAdminBusy(false)
  }

  const processWithdrawal = async (withdrawalId, status) => {
    if (!isAdmin) return

    setAdminBusy(true)

    const { data, error } = await supabase.functions.invoke(
      'withdrawal-admin',
      {
        body: {
          action: 'process',
          withdrawal_id: withdrawalId,
          status
        }
      }
    )

    if (error || !data?.ok) {
      showMessage(
        error?.message ||
          data?.error ||
          'Could not update withdrawal.',
        'admin'
      )
    } else {
      showMessage(
        status === 'paid'
          ? 'Withdrawal marked paid.'
          : 'Withdrawal rejected and refunded.',
        'admin'
      )

      await Promise.all([
        loadAdminWithdrawals(),
        refreshData()
      ])
    }

    setAdminBusy(false)
  }

  useEffect(() => {
    if (
      tab === 'earn' &&
      lootwallsOffers.length === 0 &&
      cpxOffers.length === 0 &&
      offerwallAdOffers.length === 0 &&
      cpaGripOffers.length === 0
    ) {
      loadOffers()
    }
  }, [tab])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    setMessage('')
    setMessageTab(null)
  }, [tab])

  useEffect(() => {
    if (!message) return

    const timer = window.setTimeout(() => {
      setMessage('')
      setMessageTab(null)
    }, 3500)

    return () => window.clearTimeout(timer)
  }, [message])

  const showMessage = (value, targetTab = tab) => {
    setMessage(value)
    setMessageTab(targetTab)
  }

  const doWithdraw = async e => {
    e.preventDefault()
    setMessage('')
    setMessageTab(null)

    const amount = Number(withdrawAmount)

    if (!Number.isFinite(amount) || amount <= 0) {
      showMessage('Enter a valid withdrawal amount.', 'wallet')
      return
    }

    const { data, error } = await supabase.rpc('request_withdrawal', {
      p_amount_usd: amount,
      p_upi_id: upi
    })

    if (error) {
      showMessage(error.message, 'wallet')
      return
    }

    if (!data?.ok) {
      showMessage(data?.error || 'Withdrawal failed.', 'wallet')
      return
    }

    showMessage(`Withdrawal requested: ${money(amount)}`, 'wallet')
    setWithdrawAmount('')

    if (data?.withdrawal_id) {
      supabase.functions
        .invoke('withdrawal-notify', {
          body: {
            withdrawal_id: data.withdrawal_id
          }
        })
        .catch(err => {
          console.error(
            'Telegram withdrawal notification failed:',
            err
          )
        })
    }

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

  const resolvedLootwallsOfferIds = new Set(
    lootwallsHistory
      .map(item => String(item.offer_id || ''))
      .filter(Boolean)
  )

  const resolvedCpxOfferIds = new Set([
    ...cpxTransactions.map(item => String(item.offer_id || '')),
    ...cpxOutcomes.map(item => String(item.offer_id || ''))
  ].filter(Boolean))

  const filteredStarted = startedHistory.filter(item => {
    if (item.source === 'Lootwalls') {
      return !item.offerId || !resolvedLootwallsOfferIds.has(item.offerId)
    }

    if (item.source === 'CPX Research') {
      return !item.offerId || !resolvedCpxOfferIds.has(item.offerId)
    }

    return true
  })

  const lootwallsConversionHistory = lootwallsHistory.map(item => ({
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

  const cpxTransactionHistory = cpxTransactions.map(item => ({
    id: `cpx-transaction-${item.transaction_id || item.id}`,
    offerId: String(item.offer_id || ''),
    title: item.offer_id
      ? `CPX Survey #${item.offer_id}`
      : 'CPX survey',
    reward: item.amount_local ?? 0,
    status: Number(item.status) === 2 ? 'reversed' : 'completed',
    created_at: item.updated_at || item.created_at,
    source: 'CPX Research'
  }))

  const cpxOutcomeHistory = cpxOutcomes
    .filter(item => String(item.event_type || '').toLowerCase() !== 'canceled')
    .map(item => {
      const eventType = String(item.event_type || '').toLowerCase()

      const status =
        eventType === 'screenout'
          ? 'screened out'
          : eventType === 'bonus'
          ? 'bonus'
          : eventType || 'updated'

      return {
        id: `cpx-outcome-${item.id}`,
        offerId: String(item.offer_id || ''),
        title: item.offer_id
          ? `CPX Survey #${item.offer_id}`
          : 'CPX survey',
        reward: eventType === 'bonus' ? item.amount_local ?? 0 : 0,
        status,
        created_at: item.created_at,
        source: 'CPX Research'
      }
    })

  const combinedHistory = [
    ...filteredStarted,
    ...lootwallsConversionHistory,
    ...cpxTransactionHistory,
    ...cpxOutcomeHistory
  ]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )
    .slice(0, 30)

  const seenOffers = new Set()

  const allOffers = [
    ...cpxOffers,
    ...lootwallsOffers,
    ...offerwallAdOffers,
    ...cpaGripOffers
  ].filter(offer => {
    const key = `${offer._provider}:${offer._offerId}`
    if (seenOffers.has(key)) return false
    seenOffers.add(key)
    return true
  })

  const visibleOffers =
    providerFilter === 'all'
      ? allOffers
      : allOffers.filter(offer => offer._provider === providerFilter)

  return (
    <div className="app">
      <style>{`
        html, body, #root {
          max-width: 100%;
          overflow-x: hidden;
        }

        .app main {
          padding-bottom: calc(118px + env(safe-area-inset-bottom)) !important;
          scroll-padding-bottom: calc(118px + env(safe-area-inset-bottom));
        }

        .bottom-nav {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          align-items: center;
          gap: 0 !important;
          min-height: 72px;
          padding-bottom: env(safe-area-inset-bottom);
          z-index: 100 !important;
        }

        .bottom-nav > button {
          min-width: 0 !important;
          width: 100%;
          padding: 10px 4px !important;
        }

        .bottom-nav > button span {
          font-size: 11px;
          white-space: nowrap;
        }

        .page-notice {
          margin: 0 0 18px !important;
          animation: earnwallNoticeIn .18s ease-out;
        }

        @keyframes earnwallNoticeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .profile-card {
          min-width: 0;
        }

        .profile-card > b,
        .profile-card > small {
          overflow-wrap: anywhere;
        }

        .admin-entry {
          width: 100%;
          min-height: 64px;
          margin-top: 18px;
          padding: 12px 14px;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 16px;
          background: rgba(255,255,255,.035);
          color: inherit;
          display: grid;
          grid-template-columns: auto minmax(0,1fr) auto;
          gap: 12px;
          align-items: center;
          text-align: left;
          cursor: pointer;
        }

        .admin-entry span {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .admin-entry b {
          font-size: 14px;
        }

        .admin-entry small {
          opacity: .62;
          font-size: 12px;
        }

        .admin-back {
          display: block;
          border: 0;
          background: transparent;
          color: inherit;
          opacity: .65;
          padding: 0 0 8px;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        .list .row {
          min-width: 0;
        }

        .list .row > div {
          min-width: 0;
        }

        .list .row span,
        .list .row small {
          overflow-wrap: anywhere;
        }

        @media (max-width: 380px) {
          .bottom-nav > button span {
            font-size: 10px;
          }

          .app main {
            padding-left: 18px !important;
            padding-right: 18px !important;
          }
        }
      `}</style>
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
        {message && messageTab === tab && (
          <div className="notice page-notice" role="status">
            {message}
          </div>
        )}

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
                <span className="eyebrow">CHOOSE A PROVIDER</span>
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

            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                marginBottom: '14px'
              }}
            >
              {[
                ['all', `All ${allOffers.length}`],
                ['CPX Research', `CPX ${cpxOffers.length}`],
                ['Lootwalls', `Lootwalls ${lootwallsOffers.length}`],
                ['Offerwall.ad', `Offerwall ${offerwallAdOffers.length}`],
                ['CPAGrip', `CPAGrip ${cpaGripOffers.length}`]
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setProviderFilter(id)}
                  className={providerFilter === id ? 'primary small' : 'ghost'}
                  style={{ minHeight: '36px', padding: '8px 12px' }}
                >
                  {label}
                </button>
              ))}
            </div>

            <section
              style={{
                marginBottom: '16px',
                padding: '14px',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.03)'
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '10px' }}>
                What the status means
              </h3>

              <div
                style={{
                  display: 'grid',
                  gap: '8px',
                  fontSize: '13px',
                  lineHeight: 1.45
                }}
              >
                <div>
                  <b>Started</b> — you opened the survey or offer. No reward has been earned yet.
                </div>

                <div>
                  <b>Screened out / Rejected</b> — the provider decided you did not qualify for that survey or offer. No completion reward is added.
                </div>

                <div>
                  <b>Completed</b> — the provider confirmed your completion. Your verified reward is added to your wallet.
                </div>

                <div>
                  <b>Reversed</b> — a previously completed reward was later canceled or reversed by the provider.
                </div>
              </div>
            </section>

            {loadingOffers && <div className="empty">Loading opportunities…</div>}
            {offerError && <div className="notice">{offerError}</div>}

            {!loadingOffers && visibleOffers.length === 0 && (
              <div className="empty">No earning opportunities available right now.</div>
            )}

            <div className="offer-grid">
              {visibleOffers.map(offer => (
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
                min="5"
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
                Minimum withdrawal is currently $5. Requests are manually reviewed.
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

              {isAdmin && (
                <button
                  className="admin-entry"
                  type="button"
                  onClick={() => setTab('admin')}
                >
                  <ShieldCheck size={18} />
                  <span>
                    <b>Admin dashboard</b>
                    <small>Manage withdrawal requests</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              )}

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


        {tab === 'admin' && isAdmin && (
          <>
            <div className="section-head">
              <div>
                <button
                  type="button"
                  className="admin-back"
                  onClick={() => setTab('profile')}
                >
                  ← Profile
                </button>
                <span className="eyebrow">PRIVATE ADMIN</span>
                <h2>Withdrawals</h2>
              </div>

              <button
                className="icon-btn"
                onClick={loadAdminWithdrawals}
                disabled={adminBusy}
                aria-label="Refresh withdrawals"
              >
                <RefreshCcw size={18} />
              </button>
            </div>

            <p style={{ opacity: 0.7, fontSize: '13px' }}>
              Pending requests appear here and are also sent to Telegram.
              Marking a request paid or rejected updates Supabase and the
              original Telegram message.
            </p>

            <div className="list">
              {adminWithdrawals.length === 0 && (
                <div className="empty">
                  No withdrawal requests.
                </div>
              )}

              {adminWithdrawals.map(w => (
                <div className="row" key={w.id}>
                  <div style={{ minWidth: 0 }}>
                    <b>{money(w.amount_usd)}</b>
                    <span>{w.upi_id}</span>
                    <small
                      style={{
                        display: 'block',
                        opacity: 0.6,
                        marginTop: '3px',
                        wordBreak: 'break-all'
                      }}
                    >
                      {w.user_id}
                    </small>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '8px'
                    }}
                  >
                    <em className={`status ${w.status}`}>
                      {w.status}
                    </em>

                    {w.status === 'pending' && (
                      <div
                        style={{
                          display: 'flex',
                          gap: '6px',
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end'
                        }}
                      >
                        <button
                          className="primary small"
                          disabled={adminBusy}
                          onClick={() =>
                            processWithdrawal(
                              w.id,
                              'paid'
                            )
                          }
                        >
                          Paid
                        </button>

                        <button
                          className="ghost danger"
                          disabled={adminBusy}
                          onClick={() =>
                            processWithdrawal(
                              w.id,
                              'rejected'
                            )
                          }
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <nav className="bottom-nav">
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
