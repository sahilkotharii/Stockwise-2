import React, { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, Package, Download, ShoppingCart } from "lucide-react";
import { useT } from "../theme";
import { GBtn, GIn, KCard } from "../components/UI";
import { fmtCur, toCSV, dlCSV, calcBillGst, safeDate, safeNum, sGst, sQty, sPrice, sEffPrice, sGstAmt } from "../utils";

export default function PnL({ ctx }) {
  const T = useT();
  const { bills = [], transactions = [], products = [] } = ctx;

  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? `${now.getFullYear()}-04-01` : `${now.getFullYear()-1}-04-01`;
  const fyEnd   = now.getMonth() >= 3 ? `${now.getFullYear()+1}-03-31` : `${now.getFullYear()}-03-31`;
  const [df, setDf] = useState(fyStart);
  const [dt, setDt] = useState(fyEnd);

  const inP = d => { const s = safeDate(d); return s && s >= df && s <= dt; };

  const txnsByProduct = useMemo(() => {
    const m = {};
    transactions.forEach(t => { if (!m[t.productId]) m[t.productId] = []; m[t.productId].push(t); });
    return m;
  }, [transactions]);

  // ── Helper: lookup purchase price (cost) for a product ─────────────────────
  const ppOf = pid => safeNum(products.find(p => p.id === pid)?.purchasePrice);

  const saleBills = useMemo(() => bills.filter(b => b.type === "sale"     && inP(b.date)), [bills, df, dt]);
  const purBills  = useMemo(() => bills.filter(b => b.type === "purchase" && inP(b.date)), [bills, df, dt]);
  const retTxns   = useMemo(() => transactions.filter(t => t.type === "return"           && inP(t.date)), [transactions, df, dt]);
  const purRetTxns= useMemo(() => transactions.filter(t => t.type === "purchase_return"  && inP(t.date)), [transactions, df, dt]);

  // ── REVENUE ───────────────────────────────────────────────────────────────
  const grossSalesInclGst = useMemo(() => saleBills.reduce((s,b)=>s+safeNum(b.total),0), [saleBills]);
  const gstOnSales        = useMemo(() => saleBills.reduce((s,b)=>s+(calcBillGst(b)||0),0), [saleBills]);
  const grossSalesExclGst = grossSalesInclGst - gstOnSales;

  const salesReturnValue  = useMemo(() => retTxns.reduce((s,t)=>s+sQty(t)*sPrice(t),0), [retTxns]);
  const salesReturnGst    = useMemo(() => retTxns.reduce((s,t)=>{
    const rate = sGst(t) || safeNum(products.find(p=>p.id===t.productId)?.gstRate);
    return s + sQty(t) * sPrice(t) * rate / (100+rate);
  }, 0), [retTxns, products]);
  const salesReturnExclGst = salesReturnValue - salesReturnGst;

  // ── Sales returns valued AT COST (purchase price) for inventory section ────
  const salesReturnAtCost = useMemo(() =>
    retTxns.reduce((s,t) => s + sQty(t) * ppOf(t.productId), 0)
  , [retTxns, products]);

  const netSalesExclGst = grossSalesExclGst - salesReturnExclGst;

  // ── PURCHASES ─────────────────────────────────────────────────────────────
  const totalPurchaseInclGst = useMemo(() => purBills.reduce((s,b)=>s+safeNum(b.total),0), [purBills]);
  const purchasesExclGst     = useMemo(() => purBills.reduce((s,b)=>s+safeNum(b.subtotal),0), [purBills]);
  const gstOnPurchases       = totalPurchaseInclGst - purchasesExclGst;

  const purReturnValue       = useMemo(() => purRetTxns.reduce((s,t)=>s+sQty(t)*sPrice(t),0), [purRetTxns]);
  const purReturnGst         = useMemo(() => purRetTxns.reduce((s,t)=>{
    const rate = sGst(t) || safeNum(products.find(p=>p.id===t.productId)?.gstRate);
    return s + sQty(t) * sPrice(t) * rate / 100;
  }, 0), [purRetTxns, products]);
  const purReturnExclGst     = purReturnValue - purReturnGst;
  const netPurchases         = purchasesExclGst - purReturnExclGst;

  // ── STOCK — uses transaction-level qty counting ───────────────────────────
  const stockValAt = (upTo, strictBefore) => {
    return products.reduce((s, pr) => {
      const qty = (txnsByProduct[pr.id] || []).filter(t => {
        const d = safeDate(t.date);
        if (!d) return false;
        if (t.type === "opening") return d <= upTo;
        return strictBefore ? d < upTo : d <= upTo;
      }).reduce((sq, t) => {
        if (["opening","purchase","return"].includes(t.type))      return sq + sQty(t);
        if (["sale","damaged","purchase_return"].includes(t.type)) return sq - sQty(t);
        return sq;
      }, 0);
      return s + Math.max(0, qty) * safeNum(pr.purchasePrice);
    }, 0);
  };

  const openingStock = useMemo(() => stockValAt(df, true), [products, txnsByProduct, df]);
  const closingStock = useMemo(() => stockValAt(dt, false), [products, txnsByProduct, dt]);

  const cogs        = openingStock + netPurchases - closingStock;
  const grossProfit = netSalesExclGst - cogs;
  const margin      = netSalesExclGst > 0 ? (grossProfit/netSalesExclGst*100) : 0;

  const exportCSV = () => dlCSV(toCSV([
    { item:"Gross Sales (incl. GST)",   value: grossSalesInclGst  },
    { item:"GST on Sales",              value: gstOnSales         },
    { item:"Gross Sales (excl. GST)",   value: grossSalesExclGst  },
    { item:"Sales Returns (sell price)",value: salesReturnValue   },
    { item:"Sales Return GST",          value: salesReturnGst     },
    { item:"Sales Returns (at cost)",   value: salesReturnAtCost  },
    { item:"Net Sales (excl. GST)",     value: netSalesExclGst    },
    { item:"Purchases (excl. GST)",     value: purchasesExclGst   },
    { item:"GST on Purchases",          value: gstOnPurchases     },
    { item:"Purchase Returns (excl GST)",value: purReturnExclGst  },
    { item:"Purchase Return GST",       value: purReturnGst       },
    { item:"Net Purchases (excl. GST)", value: netPurchases       },
    { item:"Opening Stock (at cost)",   value: openingStock       },
    { item:"Closing Stock (at cost)",   value: closingStock       },
    { item:"COGS",                      value: cogs               },
    { item:"Gross Profit",              value: grossProfit        },
    { item:"Gross Margin %",            value: margin.toFixed(1)+"%"},
  ], ["item","value"]), `pnl_${df}_to_${dt}`);

  const Row = ({ label, value, sub, indent=0, bold=false, color, separator }) => (
    <>
      {separator && <tr><td colSpan={2} style={{padding:"4px 0",borderTop:`1px solid ${T.borderSubtle}`}}/></tr>}
      <tr>
        <td style={{padding:"5px 8px",paddingLeft:8+indent*18,fontWeight:bold?700:400,fontSize:bold?13:12,color:bold?T.text:T.textSub}}>
          {label}
          {sub && <div style={{fontSize:11,color:T.textMuted,marginTop:1}}>{sub}</div>}
        </td>
        <td style={{padding:"5px 8px",textAlign:"right",fontWeight:bold?700:500,fontSize:bold?13:12,color:color||(bold?T.text:T.textSub)}}>
          {typeof value==="number"?fmtCur(value):value}
        </td>
      </tr>
    </>
  );

  const dataStatus = `${saleBills.length} sales · ${purBills.length} purchases · ${retTxns.length} sale returns · ${purRetTxns.length} purchase returns`;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontFamily:T.displayFont,fontWeight:700,fontSize:18,color:T.text}}>Business Summary</div>
          <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>Indicative P&L · based on recorded transactions</div>
        </div>
        <GBtn v="ghost" sz="sm" onClick={exportCSV} icon={<Download size={13}/>}>Export CSV</GBtn>
      </div>

      <div className="glass" style={{padding:"12px 16px",borderRadius: T.radius}}>
        <div className="filter-wrap">
          <span style={{fontSize:11,fontWeight:700,color:T.textMuted}}>PERIOD</span>
          <input type="date" className="inp" value={df} onChange={e=>setDf(e.target.value)} style={{flex:"0 1 130px"}}/>
          <span style={{fontSize:12,color:T.textMuted}}>→</span>
          <input type="date" className="inp" value={dt} onChange={e=>setDt(e.target.value)} style={{flex:"0 1 130px"}}/>
          <button onClick={()=>{setDf(fyStart);setDt(fyEnd);}} style={{padding:"6px 14px",borderRadius: T.radiusFull,fontSize:11,fontWeight:600,border:`1px solid ${T.borderSubtle}`,cursor:"pointer",background:"transparent",color:T.textSub}}>Current FY</button>
          <button onClick={()=>{const y=now.getFullYear();setDf(`${y}-01-01`);setDt(`${y}-12-31`);}} style={{padding:"6px 14px",borderRadius: T.radiusFull,fontSize:11,fontWeight:600,border:`1px solid ${T.borderSubtle}`,cursor:"pointer",background:"transparent",color:T.textSub}}>Calendar Year</button>
          <span style={{fontSize:11,color:T.textMuted,marginLeft:"auto"}}>{dataStatus}</span>
        </div>
      </div>

      <div className="kgrid">
        {[
          {label:"Total Sales",   value:grossSalesInclGst, sub:"incl. GST",        icon:TrendingUp,  color:T.green},
          {label:"Net Sales",     value:netSalesExclGst,   sub:"excl. GST",         icon:DollarSign,  color:T.accent},
          {label:"Total Purchase",value:totalPurchaseInclGst,sub:"incl. GST",      icon:ShoppingCart,color:T.blue},
          {label:"Gross Profit",  value:grossProfit,       sub:`${margin.toFixed(1)}% margin`, icon:TrendingDown,color:grossProfit>=0?T.green:T.red},
          {label:"Closing Stock", value:closingStock,      sub:"at cost price",     icon:Package,     color:T.amber},
        ].map((k,i)=>(
          <KCard key={i} label={k.label} value={fmtCur(k.value)} sub={k.sub} icon={k.icon} color={k.color} />
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14}}>
        {/* P&L */}
        <div className="glass" style={{padding:20,borderRadius:T.radius}}>
          <div style={{fontFamily:T.displayFont,fontWeight:700,fontSize:15,color:T.text,marginBottom:12}}>Profit & Loss</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>
            <Row label="SALES" bold/>
            <Row label="Gross Sales (incl. GST)"  value={grossSalesInclGst}    indent={1} color={T.green}/>
            <Row label="Less: GST on Sales"       value={-gstOnSales}          indent={1} color={T.textMuted}/>
            <Row label="Gross Sales (excl. GST)"  value={grossSalesExclGst}    indent={1} bold/>
            <Row label="Less: Sales Returns"      value={-salesReturnExclGst}  indent={1} color={T.red}/>
            <Row label="  GST credited back"      value={salesReturnGst}       indent={2} color={T.textMuted}/>
            <Row label="Net Sales (excl. GST)"    value={netSalesExclGst}      bold color={T.green} separator/>

            <Row label="COST OF GOODS SOLD" bold/>
            <Row label="Opening Stock (at cost)"  value={openingStock}         indent={1}/>
            <Row label="Add: Purchases (ex-GST)"  value={purchasesExclGst}     indent={1} color={T.blue}/>
            <Row label="Less: Purchase Returns"   value={-purReturnExclGst}    indent={1} color={T.textMuted}/>
            <Row label="Less: Closing Stock"      value={-closingStock}        indent={1} color={T.textMuted}/>
            <Row label="Total COGS"               value={cogs}                 bold color={T.red} separator/>

            <Row label="GROSS PROFIT"             value={grossProfit}          bold color={grossProfit>=0?T.green:T.red} separator/>
            <Row label="Gross Margin"             value={margin.toFixed(1)+"%"} indent={1} color={T.textMuted}/>
          </tbody></table>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Inventory — closing stock already includes returned units */}
          <div className="glass" style={{padding:20,borderRadius:T.radius}}>
            <div style={{fontFamily:T.displayFont,fontWeight:700,fontSize:15,color:T.text,marginBottom:12}}>Inventory (at cost)</div>
            <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>
              <Row label="Opening Stock"             value={openingStock}       indent={1}/>
              <Row label="Add: Purchases (ex-GST)"   value={purchasesExclGst}  indent={1} color={T.blue}/>
              <Row label="Less: Purchase Returns"    value={-purReturnExclGst}  indent={1} color={T.red}/>
              <Row label="Less: COGS"                value={-cogs}             indent={1} color={T.red}/>
              <Row label="Closing Stock"             value={closingStock}       bold color={T.accent} separator/>
              <Row label="Movement"                  value={closingStock-openingStock} indent={1} color={closingStock>=openingStock?T.green:T.red}/>
            </tbody></table>
            <div style={{fontSize:10,color:T.textMuted,marginTop:8}}>Sales returns are already reflected in closing stock (returned units counted back in).</div>
          </div>

          {/* GST Summary */}
          <div className="glass" style={{padding:20,borderRadius:T.radius}}>
            <div style={{fontFamily:T.displayFont,fontWeight:700,fontSize:15,color:T.text,marginBottom:12}}>GST Summary</div>
            <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>
              <Row label="GST Collected (Sales)"        value={gstOnSales}      indent={1} color={T.green}/>
              <Row label="Less: Sale Return GST"        value={-salesReturnGst}  indent={1} color={T.red}/>
              <Row label="Net GST Collected"            value={gstOnSales - salesReturnGst} bold separator/>
              <Row label="GST Paid (Purchases)"         value={gstOnPurchases}  indent={1} color={T.blue}/>
              <Row label="Less: Purchase Return GST"    value={-purReturnGst}   indent={1} color={T.red}/>
              <Row label="Net GST Paid"                 value={gstOnPurchases - purReturnGst} bold separator/>
              <Row label="Approx. GST Liability"        value={(gstOnSales - salesReturnGst) - (gstOnPurchases - purReturnGst)} bold color={T.accent} separator/>
            </tbody></table>
          </div>
        </div>
      </div>

      <div style={{padding:"10px 14px",borderRadius: T.radius,background:T.amberBg,fontSize:11,color:T.amber,border:`1px solid ${T.amber}30`}}>
         Indicative summary only. For GST filing or certified accounts, consult your CA with the CSV export.
      </div>
    </div>
  );
}
