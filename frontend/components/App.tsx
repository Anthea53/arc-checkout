"use client";
/* Arc Checkout — standalone pay-with-USDC checkout dApp (dark, teal CTA). Self-contained.
   ABI preserved: createCharge(item,price)/pay(id)/get/getMerchant/merchantSales/total. */
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
const C = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0") as `0x${string}`;
const CHAIN = 5042002, HEX = "0x4CEF52";
const ABI = [
  { name: "createCharge", type: "function", stateMutability: "nonpayable", inputs: [{ name: "item", type: "string" }, { name: "price", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "pay", type: "function", stateMutability: "payable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { name: "get", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "tuple", components: [{ name: "merchant", type: "address" }, { name: "item", type: "string" }, { name: "price", type: "uint256" }, { name: "paid", type: "bool" }, { name: "payer", type: "address" }, { name: "createdAt", type: "uint256" }, { name: "paidAt", type: "uint256" }] }] },
  { name: "getMerchant", type: "function", stateMutability: "view", inputs: [{ name: "m", type: "address" }], outputs: [{ type: "uint256[]" }] },
  { name: "merchantSales", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "total", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const cut = (a?: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
const usd = (w?: bigint) => w === undefined ? "0.00" : Number(formatEther(w)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function toArc() { const e = (window as any).ethereum; if (!e) return; try { await e.request({ method: "wallet_addEthereumChain", params: [{ chainId: HEX, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.testnet.arc.network"], blockExplorerUrls: ["https://testnet.arcscan.app"] }] }); } catch { try { await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX }] }); } catch {} } }
const CSS = `
.ck{--bg:#0c0d10;--card:#14161c;--card2:#181b22;--bd:#1c1f26;--bd2:#262a33;--mut:#8a93a3;--txt:#eef1f6;--acc:#2dd4bf;--acc2:#5eead4;min-height:100vh;background:var(--bg);color:var(--txt);font-family:'Inter','Segoe UI',system-ui,sans-serif}
.ck *{box-sizing:border-box}.ck a{color:var(--acc);text-decoration:none}
.ck header{display:flex;align-items:center;gap:10px;padding:14px 22px;border-bottom:1px solid var(--bd)}
.ck .logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:16px}
.ck .mark{width:32px;height:32px;border-radius:9px;background:#fff;color:#0c0d10;display:grid;place-items:center;font-weight:900;font-size:16px}
.ck .chip{font-size:11px;color:var(--mut);border:1px solid var(--bd2);border-radius:99px;padding:3px 9px}
.ck .btn{border:0;border-radius:9px;font:inherit;font-weight:700;cursor:pointer;padding:9px 16px;transition:.15s}.ck .btn:disabled{opacity:.5;cursor:not-allowed}
.ck .pri{background:var(--acc);color:#03201c}.ck .pri:hover:not(:disabled){background:var(--acc2)}.ck .red{background:#dc2626;color:#fff}
.ck .wrap{max-width:880px;margin:0 auto;padding:22px 22px 60px}
.ck .tabs{display:inline-flex;gap:4px;background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:4px;margin-bottom:18px}
.ck .tab{border:0;background:none;color:var(--mut);font:inherit;font-weight:700;font-size:13px;padding:8px 16px;border-radius:9px;cursor:pointer}.ck .tab.on{background:var(--acc);color:#03201c}
.ck .item{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:10px}
.ck .card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:18px;max-width:440px;margin:0 auto}
.ck label{display:block;font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;margin:8px 0 5px}
.ck input{width:100%;background:var(--bg);border:1px solid var(--bd2);border-radius:10px;padding:11px 13px;font:inherit;font-size:14px;color:var(--txt);outline:none}.ck input:focus{border-color:var(--acc)}
.ck .menu{position:absolute;right:0;top:118%;background:var(--card2);border:1px solid var(--bd2);border-radius:11px;padding:6px;min-width:190px;z-index:30;box-shadow:0 14px 34px rgba(0,0,0,.5)}
.ck .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:var(--txt);font:inherit;font-weight:600;font-size:13.5px;padding:9px 12px;border-radius:8px;cursor:pointer}.ck .menu button:hover{background:rgba(255,255,255,.05)}
`;
function ChargeRow({ id, busy, pay }: { id: bigint; busy: boolean; pay: (id: bigint, v: bigint) => void }) {
  const { data: c } = useReadContract({ address: C, abi: ABI, functionName: "get", args: [id] });
  if (!c) return null; const it = c as any;
  return (
    <div className="item">
      <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(45,212,191,.14)", display: "grid", placeItems: "center", fontSize: 19 }}>🛒</div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{it.item || `Charge #${id}`}</div><div style={{ fontSize: 11, color: "var(--mut)" }}>#{id.toString()} · {cut(it.merchant)}</div></div>
      <div style={{ textAlign: "right" }}><div style={{ fontWeight: 800, color: "var(--acc2)" }}>${usd(it.price)}</div>{it.paid ? <span style={{ fontSize: 11, color: "var(--mut)" }}>Paid ✓</span> : <button className="btn pri" style={{ padding: "6px 13px", fontSize: 12, marginTop: 3 }} disabled={busy} onClick={() => pay(id, it.price)}>{busy ? "…" : "Pay"}</button>}</div>
    </div>
  );
}
export default function App() {
  const { address, isConnected } = useAccount(); const net = useChainId();
  const { connectors, connect } = useConnect(); const { disconnect } = useDisconnect();
  const [pop, setPop] = useState(false); const [tab, setTab] = useState<"browse" | "sell">("browse");
  const [form, setForm] = useState({ item: "", price: "" });
  const tx = useWriteContract(); const rcpt = useWaitForTransactionReceipt({ hash: tx.data, query: { enabled: !!tx.data } });
  const busy = tx.isPending || rcpt.isLoading;
  const total = useReadContract({ address: C, abi: ABI, functionName: "total" });
  const mine = useReadContract({ address: C, abi: ABI, functionName: "getMerchant", args: address ? [address] : undefined, query: { enabled: !!address } });
  const sales = useReadContract({ address: C, abi: ABI, functionName: "merchantSales", args: address ? [address] : undefined, query: { enabled: !!address } });
  useEffect(() => { if (rcpt.isSuccess) { tx.reset(); setForm({ item: "", price: "" }); total.refetch(); mine.refetch(); sales.refetch(); } }, [rcpt.isSuccess]); // eslint-disable-line
  const wrong = isConnected && net !== CHAIN; const n = total.data !== undefined ? Number(total.data) : 0;
  const pay = (id: bigint, v: bigint) => tx.writeContract({ address: C, abi: ABI, functionName: "pay", args: [id], value: v });
  return (
    <div className="ck">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header>
        <div className="logo"><span className="mark">A</span>Arc Checkout</div>
        <span className="chip">Pay-with-USDC · {n} charges</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {wrong && <button className="btn red" onClick={toArc}>Switch to Arc</button>}
          <div style={{ position: "relative" }}><button className="btn pri" onClick={() => setPop(p => !p)}>{isConnected ? cut(address) : "Connect"}</button>
            {pop && <div className="menu">{isConnected ? <button onClick={() => { disconnect(); setPop(false); }} style={{ color: "#f87171" }}>Disconnect</button> : connectors.map(c => <button key={c.uid} onClick={() => { connect({ connector: c }); setPop(false); }}>{c.name}</button>)}</div>}</div>
        </div>
      </header>
      <div className="wrap">
        <div className="tabs">{([["browse", "Browse"], ["sell", "Sell"]] as const).map(([t, l]) => <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>{l}</button>)}</div>
        {tab === "browse" && <div style={{ maxWidth: 560, margin: "0 auto" }}>{n > 0 ? Array.from({ length: n }, (_, i) => BigInt(n - 1 - i)).map(id => <ChargeRow key={id.toString()} id={id} busy={busy} pay={pay} />) : <div style={{ color: "var(--mut)", textAlign: "center", padding: "40px 0" }}>No charges yet — create one in Sell 🛒</div>}</div>}
        {tab === "sell" && <div className="card">
          {sales.data !== undefined && (sales.data as bigint) > 0n && <div style={{ textAlign: "center", fontSize: 13, color: "var(--acc2)", marginBottom: 6 }}>Total sales: ${usd(sales.data as bigint)}</div>}
          <label>Item</label><input value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} placeholder="e.g. Studio Headphones" />
          <label>Price (USDC)</label><input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} type="number" placeholder="0.00" style={{ fontSize: 18, fontWeight: 800 }} />
          <button className="btn pri" style={{ width: "100%", marginTop: 14 }} disabled={!isConnected || busy || !(Number(form.price) > 0)} onClick={() => tx.writeContract({ address: C, abi: ABI, functionName: "createCharge", args: [form.item, parseEther(form.price || "0")] })}>{busy ? "…" : "Create charge 🛒"}</button>
          {mine.data && (mine.data as readonly bigint[]).length > 0 && <div style={{ fontSize: 11, color: "var(--mut)", textAlign: "center", marginTop: 8 }}>Your charge IDs: {(mine.data as readonly bigint[]).map(x => x.toString()).join(", ")}</div>}
        </div>}
        <div style={{ textAlign: "center", color: "#565e6c", fontSize: 12, marginTop: 24 }}>Built on <a href="https://arc.network" target="_blank" rel="noopener noreferrer">Arc Network</a></div>
      </div>
    </div>
  );
}
