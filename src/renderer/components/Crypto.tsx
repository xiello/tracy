import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Trash2, ExternalLink, TrendingUp, TrendingDown, Wallet, Copy, Check, Droplets, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CryptoWallet {
  id: string;
  name: string;
  address: string;
  network: 'ethereum' | 'bitcoin' | 'solana' | 'polygon';
  balance?: number;
  balanceUSD?: number;
  tokens?: TokenBalance[];
  defiPositions?: DefiPosition[];
  lastUpdated?: string;
}

interface TokenBalance {
  symbol: string;
  name: string;
  mint: string;
  balance: number;
  balanceUSD: number;
}

interface DefiPosition {
  protocol: string;
  type: 'lp' | 'lending' | 'staking';
  name: string;
  valueUSD: number;
  apy?: number;
  positionAddress?: string;
}

interface CryptoPrice {
  symbol: string;
  price: number;
  change24h: number;
}

const NETWORK_COLORS: Record<string, string> = {
  ethereum: '#627EEA',
  bitcoin: '#F7931A',
  solana: '#14F195',
  polygon: '#8247E5',
};

const NETWORK_SYMBOLS: Record<string, string> = {
  ethereum: 'ETH',
  bitcoin: 'BTC',
  solana: 'SOL',
  polygon: 'MATIC',
};

const KNOWN_TOKENS: Record<string, { symbol: string; name: string }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana' },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin' },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether' },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', name: 'Marinade SOL' },
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { symbol: 'JitoSOL', name: 'Jito SOL' },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk' },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', name: 'Jupiter' },
};

// Meteora DLMM Program ID
const METEORA_DLMM_PROGRAM = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';

// Cache for prices (5 min TTL)
let priceCache: { data: Record<string, number>; timestamp: number } | null = null;
const PRICE_CACHE_TTL = 5 * 60 * 1000;

export default function Crypto() {
  const [wallets, setWallets] = useState<CryptoWallet[]>(() => {
    const saved = localStorage.getItem('tracy_crypto_wallets');
    return saved ? JSON.parse(saved) : [];
  });
  const [prices, setPrices] = useState<Record<string, CryptoPrice>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('tracy_crypto_wallets', JSON.stringify(wallets));
  }, [wallets]);

  const fetchPrices = useCallback(async () => {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,solana,matic-network&vs_currencies=usd&include_24hr_change=true'
      );
      const data = await response.json();
      setPrices({
        ethereum: { symbol: 'ETH', price: data.ethereum?.usd || 0, change24h: data.ethereum?.usd_24h_change || 0 },
        bitcoin: { symbol: 'BTC', price: data.bitcoin?.usd || 0, change24h: data.bitcoin?.usd_24h_change || 0 },
        solana: { symbol: 'SOL', price: data.solana?.usd || 0, change24h: data.solana?.usd_24h_change || 0 },
        polygon: { symbol: 'MATIC', price: data['matic-network']?.usd || 0, change24h: data['matic-network']?.usd_24h_change || 0 },
      });
    } catch (err) {
      console.error('Failed to fetch crypto prices:', err);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    if (wallets.length > 0) refreshWallets();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  // Get token prices from Jupiter with caching
  const getTokenPrices = async (mints: string[]): Promise<Record<string, number>> => {
    if (mints.length === 0) return {};
    
    // Check cache
    if (priceCache && Date.now() - priceCache.timestamp < PRICE_CACHE_TTL) {
      const cached: Record<string, number> = {};
      const uncached: string[] = [];
      for (const mint of mints) {
        if (mint in priceCache.data) {
          cached[mint] = priceCache.data[mint];
        } else {
          uncached.push(mint);
        }
      }
      if (uncached.length === 0) return cached;
    }

    try {
      const response = await fetch(`https://price.jup.ag/v6/price?ids=${mints.slice(0, 30).join(',')}`);
      const data = await response.json();
      const prices: Record<string, number> = {};
      
      for (const [k, v] of Object.entries(data.data || {})) {
        prices[k] = (v as any).price || 0;
      }
      
      // Update cache
      priceCache = {
        data: { ...(priceCache?.data || {}), ...prices },
        timestamp: Date.now(),
      };
      
      return prices;
    } catch {
      return {};
    }
  };

  // Fetch Meteora DLMM positions using getProgramAccounts
  const fetchMeteoraPositions = async (walletAddress: string): Promise<DefiPosition[]> => {
    const positions: DefiPosition[] = [];
    
    try {
      console.log('Fetching Meteora positions for:', walletAddress);
      
      // Query Position accounts owned by this wallet
      // The owner field is at offset 8 in the Position account data
      const response = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getProgramAccounts',
          params: [
            METEORA_DLMM_PROGRAM,
            {
              encoding: 'base64',
              filters: [
                { memcmp: { offset: 8, bytes: walletAddress } }, // owner at offset 8
              ],
            },
          ],
        }),
      });

      const data = await response.json();
      console.log('Meteora response:', data);
      
      if (data.result && data.result.length > 0) {
        console.log(`Found ${data.result.length} Meteora positions`);
        
        // For each position, get details from the Meteora API
        for (const account of data.result.slice(0, 10)) { // Limit to 10 positions
          const positionAddress = account.pubkey;
          
          try {
            // Fetch position details from Meteora API
            const posResponse = await fetch(`https://dlmm-api.meteora.ag/position/${positionAddress}`);
            if (posResponse.ok) {
              const posData = await posResponse.json();
              positions.push({
                protocol: 'Meteora',
                type: 'lp',
                name: posData.pair_name || posData.name || 'DLMM Position',
                valueUSD: posData.total_value_usd || posData.liquidity || 0,
                apy: posData.apr || posData.apy,
                positionAddress,
              });
            }
          } catch {
            // If API fails, still show the position
            positions.push({
              protocol: 'Meteora',
              type: 'lp',
              name: 'DLMM Position',
              valueUSD: 0,
              positionAddress,
            });
          }
        }
      }
    } catch (err) {
      console.error('Meteora fetch error:', err);
    }
    
    return positions;
  };

  const fetchSolanaData = async (address: string): Promise<{ balance: number; tokens: TokenBalance[]; defiPositions: DefiPosition[] }> => {
    const tokens: TokenBalance[] = [];
    let defiPositions: DefiPosition[] = [];
    let solBalance = 0;

    try {
      // Fetch SOL balance
      const balanceResponse = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
      });
      const balanceData = await balanceResponse.json();
      solBalance = (balanceData.result?.value || 0) / 1e9;

      // Fetch token accounts
      const tokensResponse = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [address, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }],
        }),
      });
      const tokensData = await tokensResponse.json();
      const tokenAccounts = tokensData.result?.value || [];

      const mints: string[] = [];
      const tokenBalances: { mint: string; balance: number }[] = [];

      for (const account of tokenAccounts) {
        const info = account.account?.data?.parsed?.info;
        if (!info) continue;
        const balance = info.tokenAmount?.uiAmount || 0;
        if (balance === 0) continue;
        mints.push(info.mint);
        tokenBalances.push({ mint: info.mint, balance });
      }

      // Fetch token prices
      const tokenPrices = await getTokenPrices(mints);

      // Build token list
      for (const { mint, balance } of tokenBalances) {
        const price = tokenPrices[mint] || 0;
        const known = KNOWN_TOKENS[mint];
        tokens.push({
          symbol: known?.symbol || mint.slice(0, 4) + '...',
          name: known?.name || mint,
          mint,
          balance,
          balanceUSD: balance * price,
        });
      }

      tokens.sort((a, b) => b.balanceUSD - a.balanceUSD);

      // Fetch Meteora positions
      defiPositions = await fetchMeteoraPositions(address);

    } catch (error) {
      console.error('Solana fetch error:', error);
      setError('Failed to fetch Solana data');
    }

    return { balance: solBalance, tokens: tokens.slice(0, 15), defiPositions };
  };

  const fetchEthBalance = async (address: string, network: 'ethereum' | 'polygon'): Promise<number> => {
    try {
      const rpcUrl = network === 'ethereum' ? 'https://eth.public-rpc.com' : 'https://polygon-rpc.com';
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [address, 'latest'], id: 1 }),
      });
      const data = await response.json();
      return data.result ? parseInt(data.result, 16) / 1e18 : 0;
    } catch {
      return 0;
    }
  };

  const refreshWallets = async () => {
    setIsRefreshing(true);
    setError(null);
    await fetchPrices();

    const updatedWallets = await Promise.all(
      wallets.map(async (wallet) => {
        let balance = wallet.balance || 0;
        let tokens: TokenBalance[] = [];
        let defiPositions: DefiPosition[] = [];
        let balanceUSD = 0;

        if (wallet.network === 'solana') {
          const solData = await fetchSolanaData(wallet.address);
          balance = solData.balance;
          tokens = solData.tokens;
          defiPositions = solData.defiPositions;
          const solPrice = prices.solana?.price || 0;
          balanceUSD = balance * solPrice + 
            tokens.reduce((sum, t) => sum + t.balanceUSD, 0) + 
            defiPositions.reduce((sum, p) => sum + p.valueUSD, 0);
        } else if (wallet.network === 'ethereum' || wallet.network === 'polygon') {
          balance = await fetchEthBalance(wallet.address, wallet.network);
          balanceUSD = balance * (prices[wallet.network]?.price || 0);
        }

        return { ...wallet, balance, balanceUSD, tokens, defiPositions, lastUpdated: new Date().toISOString() };
      })
    );

    setWallets(updatedWallets);
    setIsRefreshing(false);
  };

  const addWallet = async (wallet: Omit<CryptoWallet, 'id'>) => {
    const newWallet: CryptoWallet = { ...wallet, id: crypto.randomUUID() };
    setWallets([...wallets, newWallet]);
    setShowAddModal(false);
    setTimeout(refreshWallets, 100);
  };

  const removeWallet = (id: string) => {
    setWallets(wallets.filter(w => w.id !== id));
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const totalValue = wallets.reduce((sum, w) => sum + (w.balanceUSD || 0), 0);
  const totalDefi = wallets.reduce((sum, w) => sum + (w.defiPositions?.reduce((s, p) => s + p.valueUSD, 0) || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Crypto Portfolio</h1>
          <p className="text-white/50">Wallets, tokens & DeFi positions</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={refreshWallets} disabled={isRefreshing} className="flex items-center gap-2 px-4 py-2 glass-card rounded-xl text-white/70 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Loading...' : 'Refresh'}
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-mac-accent-blue text-white rounded-xl font-medium hover:bg-blue-500 transition-colors">
            <Plus size={18} />
            Add Wallet
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-mac-accent-red/10 border border-mac-accent-red/20 rounded-xl text-mac-accent-red">
          {error}
        </div>
      )}

      {/* Price Ticker */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(prices).map(([network, data]) => (
          <div key={network} className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: NETWORK_COLORS[network] }}>
                  {data.symbol.slice(0, 1)}
                </div>
                <span className="font-medium text-white">{data.symbol}</span>
              </div>
              <div className={`flex items-center gap-1 text-sm ${data.change24h >= 0 ? 'text-mac-accent-green' : 'text-mac-accent-red'}`}>
                {data.change24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {Math.abs(data.change24h).toFixed(2)}%
              </div>
            </div>
            <p className="text-xl font-semibold tabular-nums text-white">${data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        ))}
      </div>

      {/* Portfolio Summary */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50 mb-1">Total Portfolio Value</p>
            <p className="text-3xl font-semibold tabular-nums text-white">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            {totalDefi > 0 && (
              <p className="text-sm text-white/50 mt-1">
                <Droplets size={14} className="inline mr-1" />
                ${totalDefi.toFixed(2)} in DeFi
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl">
            <Wallet size={20} className="text-white/50" />
            <span className="text-white/70">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Wallets */}
      <div className="space-y-3">
        {wallets.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <Wallet size={48} className="mx-auto mb-4 text-white/20" />
            <p className="text-white/50 mb-4">No wallets added yet</p>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-mac-accent-blue text-white rounded-xl font-medium">Add Your First Wallet</button>
          </div>
        ) : (
          wallets.map((wallet) => (
            <div key={wallet.id} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ backgroundColor: NETWORK_COLORS[wallet.network] }}>
                  {NETWORK_SYMBOLS[wallet.network].slice(0, 1)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{wallet.name}</h4>
                    <span className="px-2 py-0.5 text-xs bg-white/10 rounded-full capitalize text-white/70">{wallet.network}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <span className="font-mono truncate max-w-[200px]">{wallet.address}</span>
                    <button onClick={() => copyAddress(wallet.address)} className="p-1 hover:bg-white/10 rounded">
                      {copiedAddress === wallet.address ? <Check size={14} className="text-mac-accent-green" /> : <Copy size={14} />}
                    </button>
                    <a href={`https://${wallet.network === 'solana' ? 'solscan.io' : wallet.network === 'ethereum' ? 'etherscan.io' : 'polygonscan.com'}/address/${wallet.address}`} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-white/10 rounded">
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>

                <div className="text-right">
                  {wallet.balance !== undefined && (
                    <p className="font-semibold tabular-nums text-white">{wallet.balance.toFixed(4)} {NETWORK_SYMBOLS[wallet.network]}</p>
                  )}
                  {wallet.balanceUSD !== undefined && (
                    <p className="text-sm text-white/50 tabular-nums">${wallet.balanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  )}
                </div>

                <button onClick={() => removeWallet(wallet.id)} className="p-2 text-white/30 hover:text-mac-accent-red hover:bg-mac-accent-red/10 rounded-lg">
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Tokens */}
              {wallet.tokens && wallet.tokens.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins size={14} className="text-white/40" />
                    <p className="text-xs text-white/40">Tokens ({wallet.tokens.length})</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {wallet.tokens.slice(0, 9).map((token, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                        <span className="text-sm text-white/70 truncate">{token.symbol}</span>
                        <span className="text-sm font-medium text-white tabular-nums">${token.balanceUSD.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DeFi Positions */}
              {wallet.defiPositions && wallet.defiPositions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets size={14} className="text-mac-accent-blue" />
                    <p className="text-xs text-white/40">DeFi Positions ({wallet.defiPositions.length})</p>
                  </div>
                  <div className="space-y-2">
                    {wallet.defiPositions.map((pos, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400">
                            {pos.protocol}
                          </span>
                          <span className="text-sm text-white/70">{pos.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-white tabular-nums">
                            {pos.valueUSD > 0 ? `$${pos.valueUSD.toFixed(2)}` : 'View on Solscan'}
                          </span>
                          {pos.apy && <span className="text-xs text-mac-accent-green ml-2">{pos.apy.toFixed(1)}% APY</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showAddModal && <AddWalletModal onAdd={addWallet} onClose={() => setShowAddModal(false)} />}
      </AnimatePresence>
    </div>
  );
}

function AddWalletModal({ onAdd, onClose }: { onAdd: (wallet: Omit<CryptoWallet, 'id'>) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState<CryptoWallet['network']>('solana');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) return;
    onAdd({ name, address, network });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md glass-surface rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Add Crypto Wallet</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-white/70"><Plus size={20} className="rotate-45" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Wallet Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My SOL Wallet" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Network</label>
            <select value={network} onChange={(e) => setNetwork(e.target.value as CryptoWallet['network'])} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white">
              <option value="solana">Solana (+ Meteora DeFi)</option>
              <option value="ethereum">Ethereum</option>
              <option value="polygon">Polygon</option>
              <option value="bitcoin">Bitcoin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Wallet Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={network === 'solana' ? 'So1ana...' : '0x...'} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm placeholder-white/30" required />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-white/70 hover:bg-white/5 rounded-xl">Cancel</button>
            <button type="submit" disabled={!name || !address} className="px-4 py-2 bg-mac-accent-blue text-white rounded-xl font-medium disabled:opacity-50 hover:bg-blue-500">Add Wallet</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
